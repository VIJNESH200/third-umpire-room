import type {
  LBWData,
  RunOutData,
  CaughtBehindData,
  BoundaryData,
  OnFieldSignal,
  DecisionVerdict,
  DRSRuleEvaluation,
} from "../types/scenario";

/**
 * Evaluates the full DRS LBW protocol strictly according to ICC Playing Conditions Appendix 1 / Law 36:
 * 
 * Gate 0A: Fair Delivery Check (Front-Foot No-Ball)
 * Gate 0B: Prior Bat Contact Check (Bat/Inside-edge before pad)
 * Gate 1: Pitching Zone (Must NOT pitch outside leg stump)
 * Gate 2: Impact Zone (Must be in-line, UNLESS no shot was offered)
 * Gate 3: Wickets Projection & Umpire's Call rule application
 */
export function evaluateDRSLBW(
  lbw: LBWData,
  onFieldSignal: OnFieldSignal
): DRSRuleEvaluation {
  // Gate 0A: Fair Delivery (Front-Foot No-Ball Check)
  if (lbw.isNoBall) {
    const overturnRequired = onFieldSignal === "OUT";
    return {
      gate0FairDelivery: false,
      gate0NoPriorBat: !lbw.batContactBeforePad,
      pitchingValid: lbw.pitchingZone !== "OUTSIDE_LEG",
      impactValid: lbw.impactZone === "IN_LINE" || !lbw.shotOffered,
      wicketsHitting: lbw.projectedStumpHit === "CLEARLY_HITTING",
      isUmpiresCall: false,
      overturnRequired,
      correctFinalVerdict: "NOT_OUT",
      failedGate: "GATE_0A_NO_BALL",
      explanation: `Front-foot camera confirms the bowler overstepped the popping crease (${lbw.frontFootOverstepMm}mm overstep) with no part of the foot grounded behind the line. No Ball called. Under ICC DRS Protocol Clause 2.1, ball-tracking is aborted.`,
      ruleCitation: "ICC DRS Appendix 1 Clause 2.1 - Front Foot Fair Delivery Check: Automatic NOT OUT (No Ball)",
    };
  }

  // Gate 0B: Prior Bat Contact Check (Bat before Pad)
  if (lbw.batContactBeforePad || lbw.firstContactType === "BAT_FIRST") {
    const overturnRequired = onFieldSignal === "OUT";
    return {
      gate0FairDelivery: true,
      gate0NoPriorBat: false,
      pitchingValid: lbw.pitchingZone !== "OUTSIDE_LEG",
      impactValid: lbw.impactZone === "IN_LINE" || !lbw.shotOffered,
      wicketsHitting: lbw.projectedStumpHit === "CLEARLY_HITTING",
      isUmpiresCall: false,
      overturnRequired,
      correctFinalVerdict: "NOT_OUT",
      failedGate: "GATE_0B_BAT_FIRST",
      explanation: `Synchronized UltraEdge and slow motion confirm the ball struck the bat before hitting the pad. Under Law 36.1(a) and ICC DRS Protocol Clause 2.2, a batter cannot be out LBW if the ball makes prior contact with the bat.`,
      ruleCitation: "ICC DRS Appendix 1 Clause 2.2 / Law 36.1(a) - Prior Bat Contact Check: Automatic NOT OUT",
    };
  }

  // Gate 1: Pitching Zone (Must NOT pitch outside leg stump)
  const pitchingValid = lbw.pitchingZone !== "OUTSIDE_LEG";
  if (!pitchingValid) {
    const overturnRequired = onFieldSignal === "OUT";
    return {
      gate0FairDelivery: true,
      gate0NoPriorBat: true,
      pitchingValid: false,
      impactValid: lbw.impactZone === "IN_LINE" || !lbw.shotOffered,
      wicketsHitting: lbw.projectedStumpHit === "CLEARLY_HITTING",
      isUmpiresCall: false,
      overturnRequired,
      correctFinalVerdict: "NOT_OUT",
      failedGate: "GATE_1_PITCHING_LEG",
      explanation: `Ball pitched outside leg stump (${lbw.pitchingZone}). Law 36.1(b) dictates that a batter cannot be LBW if the ball pitches outside the leg stump.`,
      ruleCitation: "ICC DRS Appendix 1 Clause 3.2 - Pitching Zone Gate: Automatic NOT OUT",
    };
  }

  // Gate 2: Impact Zone
  const impactValid =
    lbw.impactZone === "IN_LINE" ||
    (lbw.impactZone === "OUTSIDE_LINE_NO_SHOT" && !lbw.shotOffered);

  if (!impactValid) {
    const overturnRequired = onFieldSignal === "OUT";
    return {
      gate0FairDelivery: true,
      gate0NoPriorBat: true,
      pitchingValid: true,
      impactValid: false,
      wicketsHitting: lbw.projectedStumpHit === "CLEARLY_HITTING",
      isUmpiresCall: false,
      overturnRequired,
      correctFinalVerdict: "NOT_OUT",
      failedGate: "GATE_2_IMPACT_OFF",
      explanation: `Point of first impact was outside the line of off stump and the batter was offering a genuine shot. Under Law 36.1(c), the point of first impact must be in line with the wickets unless no stroke was played.`,
      ruleCitation: "ICC DRS Appendix 1 Clause 3.3 - Impact Zone Gate: Outside Line with Shot Offered",
    };
  }

  // Gate 3: Projected Stump Hit (The Umpire's Call Rule)
  const isUmpiresCall = lbw.projectedStumpHit === "UMPIRES_CALL";
  const missing = lbw.projectedStumpHit === "MISSING";

  if (onFieldSignal === "OUT") {
    if (missing) {
      return {
        gate0FairDelivery: true,
        gate0NoPriorBat: true,
        pitchingValid: true,
        impactValid: true,
        wicketsHitting: false,
        isUmpiresCall: false,
        overturnRequired: true,
        correctFinalVerdict: "NOT_OUT",
        failedGate: "GATE_3_MISSING_WICKETS",
        explanation: `Pitching in-line, impact in-line, but projected path is MISSING the wickets. Conclusive evidence found to OVERTURN the on-field OUT decision to NOT OUT.`,
        ruleCitation: "ICC DRS Appendix 1 Clause 3.4.1 - Overturn OUT to NOT OUT (Missing Stumps)",
      };
    } else if (isUmpiresCall) {
      return {
        gate0FairDelivery: true,
        gate0NoPriorBat: true,
        pitchingValid: true,
        impactValid: true,
        wicketsHitting: true,
        isUmpiresCall: true,
        overturnRequired: false,
        correctFinalVerdict: "OUT",
        failedGate: "NONE",
        explanation: `Pitching in-line, impact in-line, wickets projection is UMPIRE'S CALL (clipping stumps within 50% ball margin). Since the original on-field decision was OUT, the on-field decision STANDS.`,
        ruleCitation: "ICC DRS Appendix 1 Clause 3.4.2 - Umpire's Call Upheld (Original Decision OUT stands)",
      };
    } else {
      // CLEARLY_HITTING
      return {
        gate0FairDelivery: true,
        gate0NoPriorBat: true,
        pitchingValid: true,
        impactValid: true,
        wicketsHitting: true,
        isUmpiresCall: false,
        overturnRequired: false,
        correctFinalVerdict: "OUT",
        failedGate: "NONE",
        explanation: `Pitching in-line, impact in-line, and projected path is CLEARLY HITTING the stumps (>50% ball volume impacting stumps). Original on-field OUT decision is CONFIRMED.`,
        ruleCitation: "ICC DRS Appendix 1 Clause 3.4.3 - Confirmation of On-Field OUT",
      };
    }
  } else {
    // onFieldSignal is NOT_OUT (or REFERRED)
    if (missing) {
      return {
        gate0FairDelivery: true,
        gate0NoPriorBat: true,
        pitchingValid: true,
        impactValid: true,
        wicketsHitting: false,
        isUmpiresCall: false,
        overturnRequired: false,
        correctFinalVerdict: "NOT_OUT",
        failedGate: "GATE_3_MISSING_WICKETS",
        explanation: `Projected path is MISSING the stumps. Original on-field NOT OUT decision STANDS.`,
        ruleCitation: "ICC DRS Appendix 1 Clause 3.4.4 - Confirmation of On-Field NOT OUT (Missing)",
      };
    } else if (isUmpiresCall) {
      return {
        gate0FairDelivery: true,
        gate0NoPriorBat: true,
        pitchingValid: true,
        impactValid: true,
        wicketsHitting: true,
        isUmpiresCall: true,
        overturnRequired: false,
        correctFinalVerdict: "NOT_OUT",
        failedGate: "NONE",
        explanation: `Wickets projection is UMPIRE'S CALL. Because the original on-field decision was NOT OUT, there is insufficient evidence to overturn. The on-field decision of NOT OUT STANDS.`,
        ruleCitation: "ICC DRS Appendix 1 Clause 3.4.5 - Umpire's Call Upheld (Original Decision NOT OUT stands)",
      };
    } else {
      // CLEARLY_HITTING
      return {
        gate0FairDelivery: true,
        gate0NoPriorBat: true,
        pitchingValid: true,
        impactValid: true,
        wicketsHitting: true,
        isUmpiresCall: false,
        overturnRequired: true,
        correctFinalVerdict: "OUT",
        failedGate: "NONE",
        explanation: `Pitching in-line, impact in-line, and projected path is CLEARLY HITTING the stumps. Conclusive evidence found to OVERTURN the on-field NOT OUT decision to OUT.`,
        ruleCitation: "ICC DRS Appendix 1 Clause 3.4.6 - Overturn NOT OUT to OUT (Clearly Hitting)",
      };
    }
  }
}

/**
 * Evaluates Run-Out / Stumping timing.
 */
export function evaluateRunOut(
  data: RunOutData,
  onFieldSignal: OnFieldSignal = "REFERRED"
): DRSRuleEvaluation {
  const isOut = data.marginMs > 0 || (data.batBounced && !data.batGrounded);
  const correctVerdict: DecisionVerdict = isOut ? "OUT" : "NOT_OUT";
  const overturnRequired = onFieldSignal !== "REFERRED" && onFieldSignal !== correctVerdict;

  let explanation = "";
  if (isOut) {
    explanation = data.batBounced
      ? `Bat bounced upon sliding and was completely airborne when the bails were removed from the stumps (${Math.abs(data.marginMs)}ms delta). OUT.`
      : `Zing bails completely dislodged ${data.marginMs}ms BEFORE the batter grounded bat/foot behind the popping crease. OUT.`;
  } else {
    explanation = `Batter safely grounded bat behind the popping crease line ${Math.abs(data.marginMs)}ms BEFORE the bails were dislodged. NOT OUT.`;
  }

  return {
    gate0FairDelivery: true,
    gate0NoPriorBat: true,
    pitchingValid: true,
    impactValid: true,
    wicketsHitting: true,
    isUmpiresCall: false,
    overturnRequired,
    correctFinalVerdict: correctVerdict,
    failedGate: "NONE",
    explanation,
    ruleCitation: isOut ? "Law 29 / 38 - Batter Short of Crease" : "Law 29 / 38 - Batter Grounded Behind Crease",
  };
}

/**
 * Evaluates Caught Behind / UltraEdge.
 */
export function evaluateCaughtBehind(
  data: CaughtBehindData,
  onFieldSignal: OnFieldSignal
): DRSRuleEvaluation {
  const isOut = data.hasEdge;
  const correctVerdict: DecisionVerdict = isOut ? "OUT" : "NOT_OUT";
  const overturnRequired = onFieldSignal !== "REFERRED" && onFieldSignal !== correctVerdict;

  let explanation = "";
  if (isOut) {
    explanation = `Synchronized UltraEdge telemetry confirms a high-frequency acoustic spike as the ball passes the outside edge of the bat. Conclusive edge established. ${overturnRequired ? "OVERTURN TO OUT." : "OUT."}`;
  } else {
    if (data.distractorNoise) {
      explanation = `UltraEdge shows an acoustic spike caused by ${data.distractorType || "pad contact"}, but clear daylight is visible between bat and ball as the ball passes. No bat edge. ${overturnRequired ? "OVERTURN TO NOT OUT." : "NOT OUT."}`;
    } else {
      explanation = `Flatline on UltraEdge as the ball passes the bat with clear gap (${data.gapMm}mm). No contact with bat. NOT OUT.`;
    }
  }

  return {
    gate0FairDelivery: true,
    gate0NoPriorBat: !isOut,
    pitchingValid: true,
    impactValid: true,
    wicketsHitting: false,
    isUmpiresCall: false,
    overturnRequired,
    correctFinalVerdict: correctVerdict,
    failedGate: "NONE",
    explanation,
    ruleCitation: isOut ? "Law 33 - Caught Behind Confirmed" : "Law 33 - No Bat Contact Established",
  };
}

/**
 * Evaluates Boundary / Catch at rope.
 */
export function evaluateBoundary(
  data: BoundaryData,
  onFieldSignal: OnFieldSignal = "REFERRED"
): DRSRuleEvaluation {
  const isOut = !data.isBoundary;
  const correctVerdict: DecisionVerdict = isOut ? "OUT" : "NOT_OUT";
  const overturnRequired = onFieldSignal !== "REFERRED" && onFieldSignal !== correctVerdict;

  const explanation = data.isBoundary
    ? `Replay confirms the fielder's boot was in contact with the boundary cushion while simultaneously holding the ball (${data.marginMm}mm contact). Boundary awarded. NOT OUT.`
    : `Clean aerial catch verified. Fielder released the ball cleanly prior to touching the boundary cushion and completed the catch legally inside the rope. OUT.`;

  return {
    gate0FairDelivery: true,
    gate0NoPriorBat: true,
    pitchingValid: true,
    impactValid: true,
    wicketsHitting: false,
    isUmpiresCall: false,
    overturnRequired,
    correctFinalVerdict: correctVerdict,
    failedGate: "NONE",
    explanation,
    ruleCitation: data.isBoundary ? "Law 19 - Boundary Cushion Contact" : "Law 33 / 19 - Clean Catch Inside Boundary",
  };
}

/**
 * Validates whether the player's verdict respected the DRS Umpire's Call rule logic.
 */
export function checkDRSCompliance(
  incidentType: string,
  userVerdict: DecisionVerdict,
  onFieldSignal: OnFieldSignal,
  drsEvaluation: DRSRuleEvaluation
): { complied: boolean; feedback: string } {
  const isCorrect = userVerdict === drsEvaluation.correctFinalVerdict;

  if (incidentType === "LBW" && drsEvaluation.isUmpiresCall) {
    if (userVerdict === onFieldSignal) {
      return {
        complied: true,
        feedback: `Mastered Umpire's Call: Correctly recognized that marginal projection upholds the original on-field call (${onFieldSignal}).`,
      };
    } else {
      return {
        complied: false,
        feedback: `Umpire's Call Violation: The projection was 'Umpire's Call'. Under ICC DRS protocol, this requires upholding the on-field ${onFieldSignal} decision, not overturning it.`,
      };
    }
  }

  if (isCorrect) {
    return {
      complied: true,
      feedback: drsEvaluation.overturnRequired
        ? `Sharp Decision: Correctly overturned the incorrect on-field call with conclusive evidence.`
        : `Solid Umpiring: Correctly confirmed the valid decision.`,
    };
  } else {
    return {
      complied: false,
      feedback: `Incorrect Verdict: Expected ${drsEvaluation.correctFinalVerdict}. ${drsEvaluation.explanation}`,
    };
  }
}
