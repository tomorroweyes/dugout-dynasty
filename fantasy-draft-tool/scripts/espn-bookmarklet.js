/**
 * ESPN Fantasy Baseball → Draft Board Sync Bookmarklet
 *
 * HOW TO USE:
 * 1. Go to your ESPN Fantasy Baseball draft room
 *    (e.g. https://fantasy.espn.com/baseball/draft?leagueId=...&teamId=...)
 * 2. Run this script in the browser console (or save as a bookmarklet — see bottom of file)
 * 3. It auto-detects your team from the roster panel, then copies all completed
 *    picks as JSON to your clipboard
 * 4. Switch to your draft board tool and click the "Import" button
 *
 * BOOKMARKLET:
 * To save as a browser bookmark, minify this IIFE and prefix with "javascript:"
 * e.g. use https://www.toptal.com/developers/javascript-minifier
 */

(function () {
  function toast(msg, type) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText = [
      "position:fixed", "top:16px", "right:16px", "z-index:999999",
      "padding:10px 16px", "border-radius:6px", "font:bold 13px/1.4 monospace",
      "pointer-events:none", "transition:opacity .4s",
      type === "error"
        ? "background:#3a0000;color:#ff8888;border:1px solid #ff3d3d66"
        : "background:#0a1a00;color:#b4f000;border:1px solid #b4f00066",
    ].join(";");
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 400); }, 2500);
  }

  // ── 1. Detect my team name from the roster dropdown ──────────────────────
  // The roster panel has a <select> whose options are fantasy team names.
  // We skip dropdowns for stats years, positions, and MLB teams by checking
  // whether any option looks like a known filter value.
  const FILTER_PATTERN =
    /^(All\s|20\d{2}|Batters|Pitchers|Free\s|Arizona|Atlanta|Baltimore|Boston|Chicago|Cincinnati|Cleveland|Colorado|Detroit|Houston|Kansas|Los\s|Miami|Milwaukee|Minnesota|New\s|Oakland|Philadelphia|Pittsburgh|San\s|Seattle|St\.\s|Tampa|Texas|Toronto|Washington|Athletics)/i;

  let myTeam = null;
  for (const sel of document.querySelectorAll("select")) {
    const texts = Array.from(sel.options).map((o) => o.text.trim());
    if (texts.length < 2) continue;
    if (texts.every((t) => !FILTER_PATTERN.test(t))) {
      myTeam = sel.options[sel.selectedIndex]?.text.trim() ?? null;
      break;
    }
  }

  if (!myTeam) {
    toast("⚠ Could not auto-detect your team — check the roster dropdown", "error");
    return;
  }

  // ── 2. Parse completed picks from the right-sidebar picks list ────────────
  // Each completed pick renders as a list item with text like:
  //   "Bobby Witt Jr. / KC SS R1, P1 - The Cito Gastons"
  //   "Shohei Ohtani / LAD DH, SP R1, P4 - Base Hitty Rollers"
  // Pattern: {name} / {MLB_TEAM} {pos[, pos...]} R{round}, P{pick} - {fantasy_team}
  const PICK_PATTERN =
    /^(.+?)\s*\/\s*\S+\s+.+?\s+R(\d+),\s*P(\d+)\s*-\s*(.+)$/;

  const teams = new Set();
  const rawPicks = [];

  for (const li of document.querySelectorAll("li")) {
    // innerText gives visual spacing; fall back to textContent and collapse whitespace
    const text = (li.innerText || li.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    const m = text.match(PICK_PATTERN);
    if (!m) continue;

    const name = m[1].trim();
    const round = parseInt(m[2], 10);
    const pickInRound = parseInt(m[3], 10);
    const fantasyTeam = m[4].trim();

    teams.add(fantasyTeam);
    rawPicks.push({ name, round, pickInRound, fantasyTeam });
  }

  if (rawPicks.length === 0) {
    toast("⚠ No picks found — has the draft started?", "error");
    return;
  }

  // ── 3. Build payload ──────────────────────────────────────────────────────
  const numTeams = teams.size;

  const picks = rawPicks.map(({ name, round, pickInRound, fantasyTeam }) => ({
    name,
    // "1.01", "2.08", etc. — same format as the DraftWizard bookmarklet
    pickStr: `${round}.${String(pickInRound).padStart(2, "0")}`,
    // Overall pick: sequential within each round (ESPN already accounts for snake order)
    overallPick: (round - 1) * numTeams + pickInRound,
    isMyPick: fantasyTeam === myTeam,
  }));

  const payload = JSON.stringify({ picks, numTeams, extractedAt: Date.now() });

  navigator.clipboard
    .writeText(payload)
    .then(() => {
      const myPicks = picks.filter((p) => p.isMyPick).length;
      toast(`✓ ${picks.length} picks copied (${myPicks} yours)`);
    })
    .catch(() => {
      toast("✗ Clipboard blocked — see console", "error");
      console.log(payload);
    });
})();
