import { STATUSES } from "./validation.js";

export function calculateAnalytics(initiatives) {
  const baseStats = initiatives.map((initiative) => initiativeAnalytics(initiative));
  const totalVotes = baseStats.reduce((sum, item) => sum + item.votes, 0);
  const totalSignatures = baseStats.reduce((sum, item) => sum + item.signatures, 0);
  const totalComments = baseStats.reduce((sum, item) => sum + item.comments, 0);
  const averageScore = initiatives.length
    ? Math.round(initiatives.reduce((sum, item) => sum + (item.aiReview?.score || 0), 0) / initiatives.length)
    : 0;

  const initiativeStats = baseStats
    .map((item) => ({
      ...item,
      voteShare: percentage(item.votes, totalVotes),
      signatureConversion: percentage(item.signatures, item.votes),
      engagementScore: roundOne(item.votes + item.signatures + item.comments * 0.5)
    }))
    .sort((a, b) => b.votes - a.votes || b.engagementScore - a.engagementScore || a.title.localeCompare(b.title));

  const byStatus = STATUSES.map((status) => ({
    ...status,
    count: baseStats.filter((initiative) => initiative.status === status.value).length,
    votes: sumBy(baseStats.filter((initiative) => initiative.status === status.value), "votes"),
    comments: sumBy(baseStats.filter((initiative) => initiative.status === status.value), "comments")
  }));

  const categoryStats = Object.values(
    baseStats.reduce((acc, initiative) => {
      const key = initiative.category || "Nekategorizirano";
      acc[key] ||= {
        category: key,
        count: 0,
        votes: 0,
        signatures: 0,
        comments: 0,
        aiScoreSum: 0
      };
      acc[key].count += 1;
      acc[key].votes += initiative.votes;
      acc[key].signatures += initiative.signatures;
      acc[key].comments += initiative.comments;
      acc[key].aiScoreSum += initiative.aiScore;
      return acc;
    }, {})
  )
    .map((item) => ({
      category: item.category,
      count: item.count,
      votes: item.votes,
      signatures: item.signatures,
      comments: item.comments,
      averageVotes: roundOne(item.votes / item.count),
      averageAiScore: Math.round(item.aiScoreSum / item.count)
    }))
    .sort((a, b) => b.votes - a.votes || b.count - a.count || a.category.localeCompare(b.category));

  const byCategory = categoryStats.reduce((acc, item) => {
    acc[item.category] = item.count;
    return acc;
  }, {});

  const topInitiatives = [...initiatives]
    .sort((a, b) => supportCount(b) - supportCount(a))
    .slice(0, 5);

  return {
    initiativeCount: initiatives.length,
    totalVotes,
    totalSignatures,
    totalComments,
    averageScore,
    byStatus,
    byCategory,
    categoryStats,
    topInitiatives,
    initiativeStats,
    voteDistribution: voteDistribution(initiativeStats),
    riskSummary: riskSummary(initiatives)
  };
}

export function calculateUserAnalytics(initiatives, user) {
  if (!user?.id) {
    return emptyUserAnalytics();
  }

  const authored = initiatives.filter((initiative) => initiative.author?.id === user.id);
  const voted = initiatives.filter((initiative) => initiative.votes?.some((vote) => vote.userId === user.id));
  const signed = initiatives.filter((initiative) => initiative.signatures?.some((signature) => signature.userId === user.id));
  const commented = initiatives.filter((initiative) => initiative.comments?.some((comment) => comment.userId === user.id));
  const authoredStats = authored.map((initiative) => initiativeAnalytics(initiative));
  const commentsWritten = initiatives.reduce(
    (total, initiative) => total + count((initiative.comments || []).filter((comment) => comment.userId === user.id)),
    0
  );
  const supportReceived = authoredStats.reduce((total, item) => total + item.support, 0);
  const commentsReceived = authoredStats.reduce((total, item) => total + item.comments, 0);
  const averageAiScore = authored.length
    ? Math.round(authored.reduce((total, initiative) => total + (initiative.aiReview?.score || 0), 0) / authored.length)
    : 0;

  return {
    authoredCount: authored.length,
    votedCount: voted.length,
    signedCount: signed.length,
    commentedInitiativeCount: commented.length,
    commentsWritten,
    supportReceived,
    commentsReceived,
    averageAiScore,
    authoredCategoryStats: categoryBreakdown(authoredStats),
    authoredStatusStats: statusBreakdown(authoredStats),
    topAuthoredInitiatives: authored
      .sort((a, b) => supportCount(b) - supportCount(a) || new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5),
    recentActivity: recentUserActivity(initiatives, user).slice(0, 8)
  };
}

export function calculateSystemAnalytics(initiatives, telemetryEvents = [], resourceSnapshot = {}, clarityInsights = null) {
  const initiativeRows = initiatives.length;
  const voteRows = initiatives.reduce((total, initiative) => total + count(initiative.votes), 0);
  const signatureRows = initiatives.reduce((total, initiative) => total + count(initiative.signatures), 0);
  const commentRows = initiatives.reduce((total, initiative) => total + count(initiative.comments), 0);
  const reviewRows = initiatives.filter((initiative) => initiative.aiReview).length;
  const telemetryAiEvents = telemetryEvents.filter((event) => event.type === "ai_review");
  const telemetryEmailEvents = telemetryEvents.filter((event) => event.type === "email_notifications");
  const telemetryVoteEvents = telemetryEvents.filter((event) => event.type === "vote");
  const participantRefs = uniqueParticipantRefs(initiatives);
  const anonymousRefs = participantRefs.filter((ref) => ref.startsWith("anon-"));
  const registeredRefs = participantRefs.filter((ref) => !ref.startsWith("anon-"));
  const sessionRefs = uniqueValues(telemetryEvents.map((event) => event.sessionId).filter(Boolean));
  const eventTypes = Object.values(
    telemetryEvents.reduce((acc, event) => {
      const key = event.type || "unknown";
      acc[key] ||= { type: key, count: 0 };
      acc[key].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  const statusRows = STATUSES.map((status) => ({
    ...status,
    count: initiatives.filter((initiative) => initiative.status === status.value).length
  }));
  const categoryRows = Object.values(
    initiatives.reduce((acc, initiative) => {
      const key = initiative.category || "Nekategorizirano";
      acc[key] ||= { category: key, initiatives: 0, votes: 0, comments: 0 };
      acc[key].initiatives += 1;
      acc[key].votes += count(initiative.votes);
      acc[key].comments += count(initiative.comments);
      return acc;
    }, {})
  ).sort((a, b) => b.initiatives - a.initiatives || b.votes - a.votes || a.category.localeCompare(b.category));

  return {
    dataRows: initiativeRows + voteRows + signatureRows + commentRows,
    initiativeRows,
    voteRows,
    signatureRows,
    commentRows,
    reviewRows,
    estimatedStoredAiTokens: initiatives.reduce((total, initiative) => total + estimateInitiativeTokens(initiative), 0),
    aiRequestCount: telemetryAiEvents.length,
    aiEstimatedTokens: telemetryAiEvents.reduce((total, event) => total + (Number(event.estimatedTokens) || 0), 0),
    aiFallbackCount: telemetryAiEvents.filter((event) => event.provider === "local" || event.fallback === true).length,
    averageAiDurationMs: average(telemetryAiEvents.map((event) => Number(event.durationMs) || 0)),
    emailNotificationEvents: telemetryEmailEvents.length,
    emailNotificationItems: telemetryEmailEvents.reduce((total, event) => total + (Number(event.count) || 0), 0),
    telemetryEventCount: telemetryEvents.length,
    telemetryEventTypes: eventTypes,
    uniqueSessionCount: sessionRefs.length,
    uniqueParticipantCount: participantRefs.length,
    registeredParticipantCount: registeredRefs.length,
    anonymousParticipantCount: anonymousRefs.length,
    anonymousVoteRows: initiatives.reduce(
      (total, initiative) => total + count((initiative.votes || []).filter((vote) => String(vote.userId || "").startsWith("anon-"))),
      0
    ),
    anonymousVoteEvents: telemetryVoteEvents.filter((event) => event.anonymous === true).length,
    publicInitiativeRows: initiatives.filter((initiative) => ["active", "signature_collection"].includes(initiative.status)).length,
    statusRows,
    categoryRows,
    resourceSnapshot: {
      resourceCount: resourceSnapshot.resourceCount || 0,
      transferKb: resourceSnapshot.transferKb || 0,
      scriptCount: resourceSnapshot.scriptCount || 0,
      stylesheetCount: resourceSnapshot.stylesheetCount || 0,
      fetchCount: resourceSnapshot.fetchCount || 0,
      loadMs: resourceSnapshot.loadMs || 0
    },
    clarity: systemClaritySummary(clarityInsights),
    recentEvents: telemetryEvents.slice(0, 10)
  };
}

export function estimateInitiativeTokens(initiative) {
  const text = [
    initiative?.title,
    initiative?.summary,
    initiative?.description,
    initiative?.legalReference,
    initiative?.expectedImpact
  ]
    .filter(Boolean)
    .join(" ");

  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(0, Math.ceil(Math.max(words * 1.35, text.length / 4)));
}

function initiativeAnalytics(initiative) {
  const votes = count(initiative.votes);
  const signatures = count(initiative.signatures);
  const comments = count(initiative.comments);

  return {
    id: initiative.id,
    title: initiative.title,
    category: initiative.category,
    status: initiative.status,
    votes,
    signatures,
    comments,
    support: votes + signatures,
    aiScore: initiative.aiReview?.score || 0,
    aiRisk: initiative.aiReview?.risk || "low",
    latestActivityAt: latestActivityAt(initiative)
  };
}

function emptyUserAnalytics() {
  return {
    authoredCount: 0,
    votedCount: 0,
    signedCount: 0,
    commentedInitiativeCount: 0,
    commentsWritten: 0,
    supportReceived: 0,
    commentsReceived: 0,
    averageAiScore: 0,
    authoredCategoryStats: [],
    authoredStatusStats: [],
    topAuthoredInitiatives: [],
    recentActivity: []
  };
}

function systemClaritySummary(insights) {
  const summary = insights?.summary || {};
  return {
    configured: Boolean(insights?.configured),
    days: Number(insights?.days) || 0,
    fetchedAt: insights?.fetchedAt || "",
    rawMetricCount: Number(insights?.rawMetricCount) || 0,
    chartCount: Array.isArray(insights?.charts) ? insights.charts.length : 0,
    sessions: Number(summary.sessions) || 0,
    users: Number(summary.users) || 0,
    botSessions: Number(summary.botSessions) || 0,
    deadClicks: Number(summary.deadClicks) || 0,
    rageClicks: Number(summary.rageClicks) || 0,
    scriptErrors: Number(summary.scriptErrors) || 0,
    reason: insights?.reason || "",
    error: insights?.error || ""
  };
}

function categoryBreakdown(stats) {
  return Object.values(
    stats.reduce((acc, item) => {
      const key = item.category || "Nekategorizirano";
      acc[key] ||= {
        category: key,
        count: 0,
        support: 0,
        comments: 0
      };
      acc[key].count += 1;
      acc[key].support += item.support;
      acc[key].comments += item.comments;
      return acc;
    }, {})
  ).sort((a, b) => b.support - a.support || b.count - a.count || a.category.localeCompare(b.category));
}

function statusBreakdown(stats) {
  return STATUSES.map((status) => ({
    ...status,
    count: stats.filter((item) => item.status === status.value).length
  })).filter((item) => item.count > 0);
}

function recentUserActivity(initiatives, user) {
  const events = [];

  for (const initiative of initiatives) {
    if (initiative.author?.id === user.id) {
      events.push({
        type: "created",
        label: "Oddana pobuda",
        title: initiative.title,
        category: initiative.category,
        createdAt: initiative.createdAt
      });
    }

    for (const vote of initiative.votes || []) {
      if (vote.userId === user.id) {
        events.push({
          type: "vote",
          label: "Glas",
          title: initiative.title,
          category: initiative.category,
          createdAt: vote.createdAt
        });
      }
    }

    for (const signature of initiative.signatures || []) {
      if (signature.userId === user.id) {
        events.push({
          type: "signature",
          label: "Podpis",
          title: initiative.title,
          category: initiative.category,
          createdAt: signature.createdAt
        });
      }
    }

    for (const comment of initiative.comments || []) {
      if (comment.userId === user.id) {
        events.push({
          type: "comment",
          label: "Komentar",
          title: initiative.title,
          category: initiative.category,
          createdAt: comment.createdAt
        });
      }
    }
  }

  return events.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function voteDistribution(stats) {
  const votes = stats.map((item) => item.votes).sort((a, b) => a - b);
  const middle = Math.floor(votes.length / 2);

  return {
    maxVotes: votes.at(-1) || 0,
    averageVotes: votes.length ? roundOne(sumBy(stats, "votes") / votes.length) : 0,
    medianVotes: votes.length ? (votes.length % 2 ? votes[middle] : roundOne((votes[middle - 1] + votes[middle]) / 2)) : 0,
    zeroVoteInitiatives: stats.filter((item) => item.votes === 0).length
  };
}

function riskSummary(initiatives) {
  return ["low", "medium", "high"].map((risk) => ({
    risk,
    count: initiatives.filter((initiative) => (initiative.aiReview?.risk || "low") === risk).length
  }));
}

function latestActivityAt(initiative) {
  const dates = [
    initiative.updatedAt,
    initiative.createdAt,
    ...(initiative.votes || []).map((vote) => vote.createdAt),
    ...(initiative.signatures || []).map((signature) => signature.createdAt),
    ...(initiative.comments || []).map((comment) => comment.createdAt)
  ].filter(Boolean);

  return dates.sort((a, b) => new Date(b) - new Date(a))[0] || "";
}

function supportCount(initiative) {
  return count(initiative.votes) + count(initiative.signatures);
}

function uniqueParticipantRefs(initiatives) {
  return uniqueValues(
    initiatives.flatMap((initiative) => [
      initiative.author?.id,
      ...(initiative.votes || []).map((vote) => vote.userId),
      ...(initiative.signatures || []).map((signature) => signature.userId),
      ...(initiative.comments || []).map((comment) => comment.userId)
    ])
  );
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function count(items) {
  return Array.isArray(items) ? items.length : 0;
}

function percentage(value, total) {
  return total > 0 ? roundOne((value / total) * 100) : 0;
}

function sumBy(items, key) {
  return items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0);
  return clean.length ? Math.round(clean.reduce((total, value) => total + value, 0) / clean.length) : 0;
}
