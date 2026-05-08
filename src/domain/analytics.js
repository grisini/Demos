import { STATUSES } from "./validation.js";

export function calculateAnalytics(initiatives) {
  const totalVotes = initiatives.reduce((sum, item) => sum + item.votes.length, 0);
  const totalSignatures = initiatives.reduce((sum, item) => sum + item.signatures.length, 0);
  const averageScore = initiatives.length
    ? Math.round(initiatives.reduce((sum, item) => sum + (item.aiReview?.score || 0), 0) / initiatives.length)
    : 0;

  const byStatus = STATUSES.map((status) => ({
    ...status,
    count: initiatives.filter((initiative) => initiative.status === status.value).length
  }));

  const byCategory = initiatives.reduce((acc, initiative) => {
    acc[initiative.category] = (acc[initiative.category] || 0) + 1;
    return acc;
  }, {});

  const topInitiatives = [...initiatives]
    .sort((a, b) => b.votes.length + b.signatures.length - (a.votes.length + a.signatures.length))
    .slice(0, 5);

  return {
    initiativeCount: initiatives.length,
    totalVotes,
    totalSignatures,
    averageScore,
    byStatus,
    byCategory,
    topInitiatives
  };
}

