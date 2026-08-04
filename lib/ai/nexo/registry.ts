import { PROJECT_SEARCH_TOOL, runProjectSearch } from "@/lib/ai/projectSearchTool";
import { PROJECT_STATS_TOOL, runProjectStatsQuery } from "@/lib/ai/projectStatsTool";
import { companySearchTool, dataQualityTool, evidenceTool, projectDetailTool } from "./intelligenceTools";
import type { NexoIntent, NexoTool } from "./types";

const projectSearchTool: NexoTool = {
  definition: PROJECT_SEARCH_TOOL,
  intents: ["project_lookup", "company_lookup", "market_analysis", "data_quality", "general"],
  execute: runProjectSearch,
};

const projectStatsTool: NexoTool = {
  definition: PROJECT_STATS_TOOL,
  intents: ["market_analysis", "data_quality", "project_lookup", "general"],
  execute: runProjectStatsQuery,
};

const TOOLS = [projectSearchTool, projectStatsTool, projectDetailTool, companySearchTool, evidenceTool, dataQualityTool];
const TOOL_BY_NAME = new Map(TOOLS.map((tool) => [tool.definition.function.name, tool]));

export function toolsForIntent(intent: NexoIntent): NexoTool[] {
  return TOOLS.filter((tool) => tool.intents.includes(intent));
}

export function getNexoTool(name: string): NexoTool | undefined {
  return TOOL_BY_NAME.get(name);
}
