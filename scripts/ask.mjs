import { answerQuestion } from "../src/rag.mjs";

const { question, mode, local } = parseArgs(process.argv.slice(2));

if (!question) {
  console.error("Usage: npm run ask -- \"질문\" --mode advanced [--local]");
  process.exit(1);
}

const result = await answerQuestion(question, { mode, local });

console.log("\n=== Answer ===\n");
console.log(result.answer);
console.log("\n=== Retrieved Contexts ===\n");
for (const [index, context] of result.contexts.entries()) {
  const heading = context.headingPath?.join(" > ") || context.id;
  const score = context.rerankScore ?? context.hybridScore ?? context.similarity ?? 0;
  console.log(`${index + 1}. ${heading}`);
  console.log(`   chunk=${context.id} score=${Number(score).toFixed(4)} provider=${context.rerankProvider ?? "retrieval"}`);
}

function parseArgs(args) {
  let mode = "advanced";
  let local = false;
  const questionParts = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--mode") {
      mode = args[i + 1] ?? mode;
      i += 1;
    } else if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length);
    } else if (arg === "--local") {
      local = true;
    } else {
      questionParts.push(arg);
    }
  }

  return {
    question: questionParts.join(" ").trim(),
    mode: mode === "naive" ? "naive" : "advanced",
    local
  };
}
