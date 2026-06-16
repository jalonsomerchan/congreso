import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const readText = (path) => readFileSync(join(root, path), 'utf8');

describe('data app structure', () => {
  it('keeps the section pages and reusable components available', () => {
    [
      'src/components/CongressHome.astro',
      'src/components/CongressListPage.astro',
      'src/components/CongressDetailPage.astro',
      'src/components/RecordCard.astro',
      'src/components/VoteDeputiesTable.astro',
      'src/components/VoteHemicycle.astro',
      'src/components/VoteResultsSummary.astro',
      'src/components/VoteSearch.astro',
      'src/config/dataConfig.ts',
      'src/lib/congressData.ts',
      'src/lib/hemicycleLayout.ts',
      'src/pages/[section]/index.astro',
      'src/pages/[section]/[id].astro',
      'src/pages/[locale]/[section]/index.astro',
      'src/pages/[locale]/[section]/[id].astro',
    ].forEach((path) => assert.equal(existsSync(join(root, path)), true, `${path} should exist`));
  });

  it('uses translated UI labels for the data app', () => {
    const es = readJson('src/i18n/translations/es.json');
    const en = readJson('src/i18n/translations/en.json');

    ['congress.home.latestVotes', 'congress.home.latestInitiatives', 'congress.home.latestSpeeches', 'congress.vote.hemicycle', 'congress.vote.unassigned', 'congress.vote.byDeputy', 'congress.search.label'].forEach((key) => {
      assert.ok(es[key], `${key} should exist in es.json`);
      assert.ok(en[key], `${key} should exist in en.json`);
    });
  });

  it('links internal routes through the localized path helper', () => {
    const card = readText('src/components/RecordCard.astro');
    const home = readText('src/components/CongressHome.astro');

    assert.match(card, /getLocalizedPath/);
    assert.match(home, /getLocalizedPath/);
  });
});
