import fs from "node:fs"

const path = "/Users/cookieqi/Downloads/Untitled/src/App.tsx"
const content = fs.readFileSync(path, "utf8")
const lines = content.split("\n")

const startIdx = lines.findIndex((l) =>
  l.trim().startsWith("function AIStatistics()"),
)
const endIdx = lines.findIndex((l) =>
  l.trim().startsWith("function AIWorkbench()"),
)

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find boundaries", { startIdx, endIdx })
  process.exit(1)
}

const before = lines.slice(0, startIdx)
const after = lines.slice(endIdx)
const replacement = [
  `function AIStatistics() {`,
  `  return <AIStatisticsModule />`,
  `}`,
  ``,
]

const newContent = [...before, ...replacement, ...after].join("\n")
fs.writeFileSync(path, newContent)
console.log(
  `Replaced lines ${startIdx + 1}-${endIdx} with AIStatisticsModule wrapper`,
)
