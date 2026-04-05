export interface DiffLine {
  type: "unchanged" | "added" | "removed";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  if (oldContent === newContent) {
    return oldContent.split("\n").map((line, i) => ({
      type: "unchanged" as const,
      content: line,
      oldLineNumber: i + 1,
      newLineNumber: i + 1,
    }));
  }

  const oldLines = oldContent === "" ? [] : oldContent.split("\n");
  const newLines = newContent === "" ? [] : newContent.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({
        type: "unchanged",
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({
        type: "added",
        content: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else {
      result.push({
        type: "removed",
        content: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  return result.reverse();
}

export function formatDiffStats(diff: DiffLine[]): {
  additions: number;
  deletions: number;
  unchanged: number;
} {
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const line of diff) {
    switch (line.type) {
      case "added":
        additions++;
        break;
      case "removed":
        deletions++;
        break;
      case "unchanged":
        unchanged++;
        break;
    }
  }

  return { additions, deletions, unchanged };
}
