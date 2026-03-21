/**
 * DraftWizard → Draft Board Sync Bookmarklet
 *
 * HOW TO USE:
 * 1. Go to https://draftwizard.fantasypros.com/baseball/mock-draft-simulator/live/
 * 2. Click the "Draft Board" tab
 * 3. Run this script in the browser console (or save as a bookmarklet — see bottom of file)
 * 4. It copies all completed picks as JSON to your clipboard
 * 5. Switch to your draft board tool and click the "Import" button
 *
 * BOOKMARKLET:
 * To save as a browser bookmark, minify this IIFE and prefix with "javascript:"
 * e.g. use https://www.toptal.com/developers/javascript-minifier
 */

(function () {
  const table = document.querySelector("table");
  if (!table) {
    alert(
      "No draft board table found.\nMake sure you are on the Draft Board tab."
    );
    return;
  }

  // Count teams from the thead row
  const headerCells = table.querySelectorAll("thead tr th, thead tr td");
  const numTeams = headerCells.length > 0 ? headerCells.length : 8;

  // Collect all completed picks (cells that have a player <a> link)
  const picks = [];

  table.querySelectorAll("tbody tr").forEach((row) => {
    [...row.querySelectorAll("td")].forEach((cell) => {
      const link = cell.querySelector("a");
      if (!link) return;

      // Use the headshot img alt ("Headshot of Bobby Witt Jr.") for the full
      // name — the <a> tag splits names across child spans so textContent
      // produces "BobbyWitt" without spaces.
      const img = cell.querySelector('img[alt^="Headshot of"]');
      const name = img
        ? img.alt.replace(/^Headshot of\s+/i, "").trim()
        : link.textContent.trim();

      const cellText = cell.textContent;

      // Extract pick string like "1.02" or "2.08"
      const m = cellText.match(/(\d+)\.(\d+)/);
      if (!m) return;

      const round = parseInt(m[1], 10);
      const pickInRound = parseInt(m[2], 10);

      // Overall pick: (round-1)*numTeams + pickInRound
      // FantasyPros numbers picks sequentially within each round (snake already handled)
      const overallPick = (round - 1) * numTeams + pickInRound;

      // "Redo" button = your own manual pick; "Edit" button = auto/other-team pick
      const btn = cell.querySelector("button");
      const isMyPick = !!(btn && btn.textContent.trim() === "Redo");

      picks.push({ name, pickStr: m[0], overallPick, isMyPick });
    });
  });

  if (picks.length === 0) {
    alert(
      "No completed picks found.\nMake sure the draft has started and you are on the Draft Board tab."
    );
    return;
  }

  const payload = JSON.stringify({ picks, numTeams, extractedAt: Date.now() });

  navigator.clipboard
    .writeText(payload)
    .then(() => {
      const myPicks = picks.filter((p) => p.isMyPick).length;
      const autoPicks = picks.filter((p) => !p.isMyPick).length;
      alert(
        `Copied ${picks.length} picks to clipboard!\n` +
          `  • ${myPicks} your pick(s)\n` +
          `  • ${autoPicks} auto pick(s)\n\n` +
          `Now click "Import" in your draft board tool.`
      );
    })
    .catch(() => {
      // Fallback: open in a new tab
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(
          '<pre style="font-size:12px;padding:16px;font-family:monospace">' +
            payload +
            "</pre>"
        );
      } else {
        prompt("Copy the JSON below:", payload);
      }
    });
})();
