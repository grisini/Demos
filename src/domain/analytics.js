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
