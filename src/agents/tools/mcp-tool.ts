import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";

// Schema for connecting to an MCP server dynamically or pre-defined
const McpToolSchema = Type.Object({
  command: Type.String({ description: "Command to start the MCP server (e.g. 'npx')" }),
  args: Type.Array(Type.String(), { description: "Arguments for the command" }),
  toolName: Type.String({ description: "Specific tool to call on the MCP server" }),
  arguments: Type.Record(Type.String(), Type.Unknown(), { description: "Arguments for the tool" }),
});

export function createMcpTool(): AnyAgentTool {
  return {
    label: "MCP Bridge",
    name: "mcp_bridge",
    description: "Bridge to execute tools from a Model Context Protocol (MCP) server.",
    parameters: McpToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const command = readStringParam(params, "command", { required: true });
      const toolName = readStringParam(params, "toolName", { required: true });
      const toolArgs = (params.arguments as Record<string, unknown>) ?? {};
      const cmdArgs = (params.args as string[]) ?? [];

      const transport = new StdioClientTransport({
        command,
        args: cmdArgs,
      });

      const client = new Client(
        {
          name: "openclaw-mcp-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      try {
        await client.connect(transport);

        // List tools to verify existence (optional, but good for debugging)
        const toolsList = await client.listTools();
        const targetTool = toolsList.tools.find((t) => t.name === toolName);

        if (!targetTool) {
          return {
            content: [{ type: "text", text: `Tool '${toolName}' not found on MCP server.` }],
            details: { availableTools: toolsList.tools.map((t) => t.name) },
          };
        }

        const result = await client.callTool({
          name: toolName,
          arguments: toolArgs,
        });

        const content = result.content as Array<{ type: string; text?: string }>;
        return {
          content: content.map((c) => {
            if (c.type === "text") return { type: "text", text: c.text ?? "" };
            return { type: "text", text: `[${c.type} content]` };
          }),
          details: { result },
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `MCP Error: ${String(err)}` }],
          details: { error: String(err) },
        };
      } finally {
        try {
          await client.close();
        } catch (e) {
          /* ignore */
        }
      }
    },
  };
}
