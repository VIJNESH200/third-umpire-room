/**
 * src/components/career/MobilePhoneModal.tsx
 *
 * Broadcast-style mobile phone device interface for Career Mode.
 * Contains:
 * - Tab 1: Balance (cash tracking, progress to ₹1M, earnings breakdown)
 * - Tab 2: Betting (pre-match odds, stake input, potential payout, active bet slip)
 * - Tab 3: Messages (shady bookmaker messages, bribe proposals, accept/decline)
 *
 * Features accessible focus states, keyboard navigation, and clean modal presentation.
 */

import React, { useState } from "react";
import {
  Smartphone,
  X,
  TrendingUp,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import type {
  CareerProfile,
  BettingMarket,
  PreMatchBet,
  BribeOffer,
  CorruptionContract,
} from "../../types/career";
import { CAREER_CONSTANTS } from "../../engine/career/careerConstants";
import { validateBet, createPreMatchBet } from "../../engine/career/betting";
import { acceptBribeOffer } from "../../engine/career/corruption";

interface MobilePhoneModalProps {
  readonly profile: CareerProfile;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly bettingMarket: BettingMarket | null;
  readonly currentBet: PreMatchBet | null;
  readonly onPlaceBet: (bet: PreMatchBet) => void;
  readonly bribeOffer: BribeOffer | null;
  readonly activeContract: CorruptionContract | null;
  readonly onAcceptBribe: (contract: CorruptionContract) => void;
  readonly onDeclineBribe: () => void;
  readonly isMatchLive?: boolean;
}

type PhoneTab = "BALANCE" | "BETTING" | "MESSAGES";

export const MobilePhoneModal: React.FC<MobilePhoneModalProps> = ({
  profile,
  isOpen,
  onClose,
  bettingMarket,
  currentBet,
  onPlaceBet,
  bribeOffer,
  activeContract,
  onAcceptBribe,
  onDeclineBribe,
  isMatchLive = false,
}) => {
  const [activeTab, setActiveTab] = useState<PhoneTab>(
    bribeOffer && bribeOffer.status === "OFFERED" && !activeContract
      ? "MESSAGES"
      : "BALANCE"
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    bettingMarket?.homeOdds.teamId ?? ""
  );
  const [stakeInput, setStakeInput] = useState<string>("1000");
  const [betError, setBetError] = useState<string | null>(null);

  if (!isOpen) return null;

  const winProgressPercent = Math.min(
    100,
    Math.round((profile.money / CAREER_CONSTANTS.TARGET_WIN_BALANCE) * 100)
  );

  const handlePlaceBetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bettingMarket || isMatchLive) return;

    const stake = parseInt(stakeInput, 10);
    const validation = validateBet(stake, profile.money);
    if (!validation.valid) {
      setBetError(validation.reason ?? "Invalid bet");
      return;
    }

    const oddsObj =
      selectedTeamId === bettingMarket.homeOdds.teamId
        ? bettingMarket.homeOdds
        : bettingMarket.awayOdds;

    const bet = createPreMatchBet(
      bettingMarket.matchId,
      oddsObj.teamId,
      oddsObj.teamName,
      stake,
      oddsObj.oddsMultiplier
    );

    onPlaceBet(bet);
    setBetError(null);
  };

  const hasUnreadBribe =
    bribeOffer && bribeOffer.status === "OFFERED" && !activeContract;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Umpire Personal Smartphone"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn select-none"
    >
      {/* Phone Casing */}
      <div className="relative w-full max-w-sm bg-[#0B0F19] border-2 border-slate-700/80 rounded-[36px] shadow-2xl overflow-hidden flex flex-col h-[650px] max-h-[92vh]">
        {/* Phone Notch & Speaker bar */}
        <div className="bg-[#070A10] pt-2 pb-1.5 px-6 flex items-center justify-between border-b border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 font-bold">19:42</span>
          <div className="w-16 h-3 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-slate-800" />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] font-mono text-emerald-400 font-bold">5G</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close smartphone"
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Phone App Header */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-slate-900 to-[#111827] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Smartphone size={15} className="text-cyan-400" />
            <span className="text-xs font-black tracking-wider uppercase font-display text-white">
              COMMUNICATION HUB
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            {profile.currentLeague.split(" ")[0]}
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 bg-[#070A10] border-b border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("BALANCE")}
            aria-label="View Cash Balance Tab"
            className={`py-2 flex items-center justify-center space-x-1 font-bold transition-colors cursor-pointer border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              activeTab === "BALANCE"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wallet size={13} />
            <span>CASH</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("BETTING")}
            aria-label="View Sports Wagering Tab"
            className={`py-2 flex items-center justify-center space-x-1 font-bold transition-colors cursor-pointer border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              activeTab === "BETTING"
                ? "border-amber-500 text-amber-400 bg-amber-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <TrendingUp size={13} />
            <span>BETTING</span>
            {currentBet && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("MESSAGES")}
            aria-label="View Messages and Syndicate Proposals Tab"
            className={`py-2 flex items-center justify-center space-x-1 font-bold transition-colors cursor-pointer border-b-2 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
              activeTab === "MESSAGES"
                ? "border-purple-500 text-purple-400 bg-purple-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare size={13} />
            <span>INBOX</span>
            {hasUnreadBribe && (
              <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-500 animate-ping" />
            )}
          </button>
        </div>

        {/* Phone Content Screen */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-200">
          {/* TAB 1: BALANCE */}
          {activeTab === "BALANCE" && (
            <div className="space-y-4">
              <div className="bg-[#121826] border border-slate-800 rounded-2xl p-4 text-center space-y-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">
                  CAREER LIQUID BALANCE
                </span>
                <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                  ₹{profile.money.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400 font-sans">
                  Goal: ₹{CAREER_CONSTANTS.TARGET_WIN_BALANCE.toLocaleString()}
                </div>

                {/* Progress to 1M */}
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${winProgressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-1">
                  <span>0%</span>
                  <span className="text-cyan-300 font-bold">{winProgressPercent}% TO RETIREMENT</span>
                  <span>₹1M</span>
                </div>
              </div>

              {/* Status Meters */}
              <div className="bg-[#121826] border border-slate-800 rounded-2xl p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-400">Integrity Trust:</span>
                  <span
                    className={`font-bold ${
                      profile.integrityScore >= 70
                        ? "text-emerald-400"
                        : profile.integrityScore >= 40
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {profile.integrityScore}/100
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-400">ACU Investigation Risk:</span>
                  <span
                    className={`font-bold ${
                      profile.investigationRisk > 40
                        ? "text-red-400"
                        : profile.investigationRisk > 15
                        ? "text-amber-400"
                        : "text-slate-300"
                    }`}
                  >
                    {profile.investigationRisk}%
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-400">Matches Officiated:</span>
                  <span className="font-bold text-slate-200">{profile.matchesCompleted}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BETTING */}
          {activeTab === "BETTING" && (
            <div className="space-y-3.5">
              {isMatchLive && (
                <div className="bg-amber-950/40 border border-amber-600/50 p-2.5 rounded-xl text-xs text-amber-300 flex items-center space-x-2">
                  <AlertTriangle size={15} />
                  <span>Match in progress. Pre-match betting is closed.</span>
                </div>
              )}

              {currentBet ? (
                /* Active Bet Slip */
                <div className="bg-[#121826] border border-amber-500/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">
                      ACTIVE PRE-MATCH WAGER
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono">
                      PENDING MATCH RESULT
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-bold text-white">
                      Backing: {currentBet.teamName}
                    </div>
                    <div className="flex justify-between text-xs font-mono text-slate-300">
                      <span>Stake:</span>
                      <span className="font-bold">₹{currentBet.stake.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono text-slate-300">
                      <span>Odds:</span>
                      <span className="font-bold">{currentBet.odds.toFixed(2)}x</span>
                    </div>
                    <div className="flex justify-between text-xs font-mono text-emerald-400 pt-1 border-t border-slate-800">
                      <span>Potential Payout:</span>
                      <span className="font-bold">₹{currentBet.potentialPayout.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : bettingMarket && !isMatchLive ? (
                /* Betting Market Selection */
                <form onSubmit={handlePlaceBetSubmit} className="space-y-3.5">
                  <div className="text-[11px] text-slate-400">
                    Select team to back before first ball is bowled:
                  </div>

                  {/* Team Odds Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTeamId(bettingMarket.homeOdds.teamId)}
                      aria-label={`Select ${bettingMarket.homeOdds.teamName} at ${bettingMarket.homeOdds.oddsMultiplier.toFixed(2)}x odds`}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        selectedTeamId === bettingMarket.homeOdds.teamId
                          ? "bg-amber-950/50 border-amber-500 text-white shadow-md ring-1 ring-amber-400"
                          : "bg-[#121826] border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div className="text-xs font-bold truncate">
                        {bettingMarket.homeOdds.teamName}
                      </div>
                      <div className="text-base font-black text-amber-400 font-mono mt-1">
                        {bettingMarket.homeOdds.oddsMultiplier.toFixed(2)}x
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedTeamId(bettingMarket.awayOdds.teamId)}
                      aria-label={`Select ${bettingMarket.awayOdds.teamName} at ${bettingMarket.awayOdds.oddsMultiplier.toFixed(2)}x odds`}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        selectedTeamId === bettingMarket.awayOdds.teamId
                          ? "bg-amber-950/50 border-amber-500 text-white shadow-md ring-1 ring-amber-400"
                          : "bg-[#121826] border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div className="text-xs font-bold truncate">
                        {bettingMarket.awayOdds.teamName}
                      </div>
                      <div className="text-base font-black text-amber-400 font-mono mt-1">
                        {bettingMarket.awayOdds.oddsMultiplier.toFixed(2)}x
                      </div>
                    </button>
                  </div>

                  {/* Stake Input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <label htmlFor="wager-stake-input">Stake (₹)</label>
                      <span>Balance: ₹{profile.money.toLocaleString()}</span>
                    </div>
                    <input
                      id="wager-stake-input"
                      type="number"
                      min={CAREER_CONSTANTS.MIN_BET_AMOUNT}
                      max={profile.money}
                      step={500}
                      value={stakeInput}
                      onChange={(e) => setStakeInput(e.target.value)}
                      aria-label="Wager stake amount in rupees"
                      className="w-full bg-[#070A10] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus:border-amber-400"
                    />

                    {/* Quick Stake buttons */}
                    <div className="flex gap-1.5 pt-1">
                      {[1000, 2500, 5000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          disabled={amt > profile.money}
                          onClick={() => setStakeInput(amt.toString())}
                          aria-label={`Add ₹${amt.toLocaleString()} to stake`}
                          className="flex-1 py-1 text-[10px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          +₹{amt}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setStakeInput(profile.money.toString())}
                        aria-label="Bet entire available balance"
                        className="py-1 px-2 text-[10px] rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/40 cursor-pointer font-mono font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        ALL IN
                      </button>
                    </div>
                  </div>

                  {betError && (
                    <div className="text-xs text-red-400 font-medium" role="alert">
                      {betError}
                    </div>
                  )}

                  {/* Potential Return preview */}
                  {(() => {
                    const parsedStake = parseInt(stakeInput, 10);
                    const currentOdds =
                      selectedTeamId === bettingMarket.homeOdds.teamId
                        ? bettingMarket.homeOdds.oddsMultiplier
                        : bettingMarket.awayOdds.oddsMultiplier;
                    const payout = Number.isFinite(parsedStake) && parsedStake > 0
                      ? Math.round(parsedStake * currentOdds)
                      : 0;

                    return (
                      <div className="bg-[#070A10] p-2.5 rounded-xl border border-slate-800 flex justify-between text-xs font-mono">
                        <span className="text-slate-400">Potential Return:</span>
                        <span className="text-emerald-400 font-bold">
                          ₹{payout.toLocaleString()}
                        </span>
                      </div>
                    );
                  })()}

                  <button
                    type="submit"
                    aria-label="Confirm and lock pre-match wager"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs font-display tracking-wider uppercase transition-all shadow-md active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    LOCK PRE-MATCH BET
                  </button>
                </form>
              ) : (
                <div className="text-xs text-slate-400 text-center py-8">
                  No active betting market available for this fixture.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MESSAGES / CORRUPTION */}
          {activeTab === "MESSAGES" && (
            <div className="space-y-3.5">
              {activeContract ? (
                /* Active Corruption Contract */
                <div className="bg-red-950/30 border border-red-500/50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-red-400">
                    <ShieldAlert size={16} />
                    <span className="text-xs font-black uppercase tracking-wider font-display">
                      ACTIVE ILLICIT CONTRACT
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Beneficiary Target:{" "}
                    <b className="text-amber-400 font-semibold">
                      {activeContract.targetTeamName}
                    </b>
                    . A deliberately incorrect verdict favoring them will release{" "}
                    <b className="text-emerald-400 font-mono">
                      ₹{activeContract.bribeAmount.toLocaleString()}
                    </b>{" "}
                    at match completion.
                  </p>

                  <div className="text-[11px] p-2 rounded-lg bg-black/40 border border-red-900/50 text-red-300 font-mono">
                    Status: {activeContract.fulfilled ? "CONDITIONS FULFILLED (PAYOUT READY)" : "WAITING FOR INCIDENT"}
                  </div>
                </div>
              ) : bribeOffer && bribeOffer.status === "OFFERED" ? (
                /* Incoming Bribe Message */
                <div className="bg-[#121826] border border-purple-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                      <span className="text-xs font-bold text-purple-300">
                        {bribeOffer.sender}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Encrypted</span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed italic">
                    "{bribeOffer.text}"
                  </p>

                  <div className="bg-[#070A10] p-2.5 rounded-xl border border-slate-800 space-y-1 text-xs">
                    <div className="flex justify-between font-mono">
                      <span className="text-slate-400">Promised Reward:</span>
                      <span className="text-emerald-400 font-bold">
                        ₹{bribeOffer.bribeAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-slate-400">Target Franchise:</span>
                      <span className="text-amber-300 font-bold">
                        {bribeOffer.targetTeamName}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono text-[10px] text-red-400 pt-1">
                      <span>Integrity Risk:</span>
                      <span>+30% Investigation Hazard</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onAcceptBribe(acceptBribeOffer(bribeOffer))}
                      aria-label="Accept bribe offer and enter corruption contract"
                      className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer font-display focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                    >
                      ACCEPT (TAKE RISK)
                    </button>
                    <button
                      type="button"
                      onClick={onDeclineBribe}
                      aria-label="Decline illicit syndicate proposal"
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer font-display focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      DECLINE
                    </button>
                  </div>
                </div>
              ) : (
                /* No Messages */
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <CheckCircle size={28} className="mx-auto text-slate-600" />
                  <div className="text-xs font-medium">Inbox is quiet.</div>
                  <div className="text-[11px] text-slate-600 max-w-xs mx-auto">
                    No active proposals or communication alerts at this time.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Phone Bar */}
        <div className="bg-[#070A10] py-2 flex items-center justify-center border-t border-slate-800">
          <div className="w-24 h-1 bg-slate-700 rounded-full" />
        </div>
      </div>
    </div>
  );
};
