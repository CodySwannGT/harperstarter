/**
 * Unit tests for the direct-deploy replication-failure classifier.
 * @module tests/deploy_result.test
 */
import { describe, expect, it } from "vitest";
import { isFreshnessCheckableDirectDeployFailure } from "../src/lib/deploy-result.js";

describe("isFreshnessCheckableDirectDeployFailure", () => {
  it("continues verification when direct deploy lands but replication fails", () => {
    expect(
      isFreshnessCheckableDirectDeployFailure(500, {
        error:
          "Component 'your-project' was deployed on the origin node but failed to replicate to 1 of 1 peer node(s)",
      })
    ).toBe(true);
  });

  it("does not mask unrelated direct deploy failures", () => {
    expect(
      isFreshnessCheckableDirectDeployFailure(500, {
        error: "ClientError: invalid deployment payload",
      })
    ).toBe(false);
  });

  it("accepts raw deploy response text", () => {
    expect(
      isFreshnessCheckableDirectDeployFailure(
        500,
        "Component 'your-project' was deployed on the origin node but failed to replicate to 1 of 1 peer node(s)"
      )
    ).toBe(true);
  });

  it("only treats HTTP 500 as freshness-checkable", () => {
    expect(
      isFreshnessCheckableDirectDeployFailure(
        200,
        "was deployed on the origin node but failed to replicate"
      )
    ).toBe(false);
  });

  it("ignores missing deploy response bodies", () => {
    expect(isFreshnessCheckableDirectDeployFailure(500, undefined)).toBe(false);
  });
});
