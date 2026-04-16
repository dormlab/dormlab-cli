import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, render, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { loadConfig, type HostConfig } from "./config.js";
import { sshCapture, sshInteractive, sshRun } from "./ssh.js";

type Status = "unknown" | "checking" | "ok" | "down";
type Screen =
  | { kind: "hosts" }
  | { kind: "actions"; host: HostConfig }
  | { kind: "command"; host: HostConfig }
  | { kind: "running"; host: HostConfig; cmd: string };

interface HostRow {
  host: HostConfig;
  status: Status;
  latencyMs?: number;
}

function statusGlyph(s: Status): { glyph: string; color: string } {
  switch (s) {
    case "ok":
      return { glyph: "●", color: "green" };
    case "down":
      return { glyph: "●", color: "red" };
    case "checking":
      return { glyph: "◌", color: "yellow" };
    default:
      return { glyph: "○", color: "gray" };
  }
}

const App: React.FC = () => {
  const { exit } = useApp();
  const cfg = useMemo(() => loadConfig(), []);
  const [rows, setRows] = useState<HostRow[]>(() =>
    Object.values(cfg.hosts).map((h) => ({ host: h, status: "unknown" })),
  );
  const [screen, setScreen] = useState<Screen>({ kind: "hosts" });
  const [cmdInput, setCmdInput] = useState("");
  const [runOutput, setRunOutput] = useState<string>("");

  // Kick off a reachability check on mount.
  useEffect(() => {
    let cancelled = false;
    setRows((prev) => prev.map((r) => ({ ...r, status: "checking" })));
    (async () => {
      await Promise.all(
        Object.values(cfg.hosts).map(async (h) => {
          const t0 = Date.now();
          const res = await sshCapture(h, "true", 5000);
          const dt = Date.now() - t0;
          if (cancelled) return;
          setRows((prev) =>
            prev.map((r) =>
              r.host.name === h.name
                ? {
                    ...r,
                    status: res.code === 0 ? "ok" : "down",
                    latencyMs: res.code === 0 ? dt : undefined,
                  }
                : r,
            ),
          );
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg]);

  useInput((input, key) => {
    if (input === "q" && screen.kind === "hosts") {
      exit();
    }
    if (key.escape) {
      if (screen.kind !== "hosts") setScreen({ kind: "hosts" });
    }
  });

  if (screen.kind === "hosts") {
    const items = rows.map((r) => ({
      label: `${statusGlyph(r.status).glyph}  ${r.host.name.padEnd(8)}  ${r.host.user}@${r.host.host}${r.latencyMs ? `  (${r.latencyMs}ms)` : ""}`,
      value: r.host.name,
    }));
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            DormLab
          </Text>
          <Text color="gray"> — pick a host (↑/↓, enter). q to quit.</Text>
        </Box>
        <Box flexDirection="column" marginBottom={1}>
          {rows.map((r) => {
            const g = statusGlyph(r.status);
            return (
              <Box key={r.host.name}>
                <Text color={g.color}>{g.glyph}</Text>
                <Text>
                  {"  "}
                  {r.host.name.padEnd(10)}
                </Text>
                <Text color="gray">
                  {r.host.user}@{r.host.host}
                  {r.latencyMs ? `  ${r.latencyMs}ms` : ""}
                </Text>
              </Box>
            );
          })}
        </Box>
        <SelectInput
          items={items}
          onSelect={(item) => {
            const host = cfg.hosts[item.value as string];
            if (host) setScreen({ kind: "actions", host });
          }}
        />
      </Box>
    );
  }

  if (screen.kind === "actions") {
    const host = screen.host;
    const items = [
      { label: "Open interactive SSH", value: "ssh" },
      { label: "Run a command…", value: "cmd" },
      { label: "Re-ping (uptime)", value: "ping" },
      { label: "← Back", value: "back" },
    ];
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {host.name}
          </Text>
          <Text color="gray">
            {"  "}
            {host.user}@{host.host}:{host.port}
          </Text>
        </Box>
        <SelectInput
          items={items}
          onSelect={async (item) => {
            if (item.value === "back") {
              setScreen({ kind: "hosts" });
            } else if (item.value === "ssh") {
              // Unmount Ink, hand the terminal to ssh, re-exit.
              exit();
              setTimeout(async () => {
                const code = await sshInteractive(host);
                process.exit(code);
              }, 10);
            } else if (item.value === "cmd") {
              setCmdInput("");
              setScreen({ kind: "command", host });
            } else if (item.value === "ping") {
              setRunOutput("…");
              setScreen({ kind: "running", host, cmd: "uptime" });
              const res = await sshCapture(host, "uptime", 8000);
              setRunOutput(res.stdout || res.stderr || `exit ${res.code}`);
            }
          }}
        />
      </Box>
    );
  }

  if (screen.kind === "command") {
    const host = screen.host;
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            {host.name}
          </Text>
          <Text color="gray">
            {"  "}run command (enter to execute, esc to cancel)
          </Text>
        </Box>
        <Box>
          <Text color="green">$ </Text>
          <TextInput
            value={cmdInput}
            onChange={setCmdInput}
            onSubmit={async (value) => {
              const cmd = value.trim();
              if (!cmd) {
                setScreen({ kind: "actions", host });
                return;
              }
              exit();
              setTimeout(async () => {
                const code = await sshRun(host, cmd);
                process.exit(code);
              }, 10);
            }}
          />
        </Box>
      </Box>
    );
  }

  // running: show captured output and wait for user
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {screen.host.name}
        </Text>
        <Text color="gray">
          {"  $ "}
          {screen.cmd}
        </Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {runOutput.split("\n").map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
      <SelectInput
        items={[
          { label: "← Back", value: "back" },
          { label: "Quit", value: "quit" },
        ]}
        onSelect={(item) => {
          if (item.value === "quit") exit();
          else setScreen({ kind: "actions", host: screen.host });
        }}
      />
    </Box>
  );
};

export async function runTui() {
  const { waitUntilExit } = render(<App />);
  await waitUntilExit();
}
