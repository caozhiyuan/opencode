import { describe, expect } from "bun:test"
import { Effect, Exit, Layer, Ref } from "effect"
import { Agent } from "@/agent/agent"
import { Provider } from "@/provider/provider"
import { Question } from "@/question"
import { Session } from "@/session/session"
import { MessageID, SessionID } from "@/session/schema"
import { PlanExitTool } from "@/tool/plan"
import { Tool } from "@/tool/tool"
import { Truncate } from "@/tool/truncate"
import { it } from "../lib/effect"

describe("tool.plan", () => {
  it.effect("checks permission before asking to switch to build", () =>
    Effect.gen(function* () {
      const permissionRequests = yield* Ref.make<string[]>([])
      const questionRequests = yield* Ref.make(0)
      const layer = Layer.mergeAll(
        Layer.mock(Session.Service)({}),
        Layer.mock(Provider.Service)({}),
        Layer.mock(Question.Service)({
          ask: () => Ref.update(questionRequests, (count) => count + 1).pipe(Effect.andThen(Effect.die("blocked"))),
        }),
        Layer.mock(Truncate.Service)({}),
        Layer.mock(Agent.Service)({}),
      )

      const exit = yield* Effect.gen(function* () {
        const toolInfo = yield* PlanExitTool
        const tool = yield* toolInfo.init()
        return yield* tool.execute(
          {},
          {
            sessionID: SessionID.make("ses_test-plan-exit"),
            messageID: MessageID.make("msg_test-plan-exit"),
            agent: "build",
            abort: AbortSignal.any([]),
            messages: [],
            metadata: () => Effect.void,
            ask: (input) =>
              Ref.update(permissionRequests, (items) => items.concat(input.permission)).pipe(
                Effect.andThen(Effect.die("blocked")),
              ),
          } satisfies Tool.Context,
        )
      }).pipe(Effect.provide(layer), Effect.exit)

      expect(Exit.isFailure(exit)).toBe(true)
      expect(yield* Ref.get(permissionRequests)).toEqual(["plan_exit"])
      expect(yield* Ref.get(questionRequests)).toBe(0)
    }),
  )
})
