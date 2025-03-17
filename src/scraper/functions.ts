import * as cheerio from 'cheerio';

// Interface definitions
export interface TopPlayer {
  rank: number;
  name: string;
  fide_id: string;
  title: string;
  country: string;
  rating: number;
  games: number;
  birth_year: number;
}

export interface PlayerHistory {
  period: string;
  classical_rating: number;
  classical_games: number;
  rapid_rating: number;
  rapid_games: number;
  blitz_rating: number;
  blitz_games: number;
  date: string;
}

export interface PlayerInfo {
  fide_id: string;
  name: string;
  country: string;
  birth_year: number | null;
  title: string;
  rating: number;
  age?: number;
  sex?: string | null;
  world_rank_all?: number | null;
  world_rank_active?: number | null;
  continental_rank_all?: number | null;
  continental_rank_active?: number | null;
  national_rank_all?: number | null;
  national_rank_active?: number | null;
}

// Need to create this utility function
export function fideToNumericDate(dateStr: string): string {
  // Convert FIDE date format (e.g., "2023-Jan") to numeric string (e.g., "2023-01")
  const months: { [key: string]: string } = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };

  const parts = dateStr.split('-');
  if (parts.length === 2 && months[parts[1]]) {
    return `${parts[0]}-${months[parts[1]]}`;
  }
  return dateStr;
}

export function get_top_players(htmlDoc: string): TopPlayer[] {
  const $ = cheerio.load(htmlDoc);
  const players: TopPlayer[] = [];

  // Using specific table selector matching the Python implementation
  const tableSelector = "#main-col > table:nth-child(2) > tr:nth-child(2) > td > table";
  const table = $(tableSelector);

  // Skip the header row
  const rows = table.find('tr').slice(1);

  rows.each((_, row) => {
    const cells = $(row).find('td');
    const playerUrl = $(cells[1]).find('a').attr('href') || '';
    const fideId = playerUrl.split('=')[1] || '';

    const player = {
      rank: parseInt($(cells[0]).text().replace(/\u00A0/g, '').trim(), 10) || 0,
      name: $(cells[1]).text().trim(),
      fide_id: fideId,
      title: $(cells[2]).text().replace(/\u00A0/g, '').trim(),
      country: $(cells[3]).text().replace(/\u00A0/g, '').trim(),
      rating: parseInt($(cells[4]).text().replace(/\u00A0/g, '').trim(), 10) || 0,
      games: parseInt($(cells[5]).text().replace(/\u00A0/g, '').trim(), 10) || 0,
      birth_year: parseInt($(cells[6]).text().replace(/\u00A0/g, '').trim(), 10) || 0,
    };

    players.push(player);
  });

  return players;
}

export function get_player_history(htmlDoc: string): PlayerHistory[] {
  const $ = cheerio.load(htmlDoc);
  const history: PlayerHistory[] = [];

  // More precise table selector to match the Python implementation
  const tableSelector = "body > section.container.section-profile > div.row.no-gutters > div.profile-bottom.col-lg-12 > div.profile-tab-containers > div:nth-child(3) > div > div.col-lg-12.profile-tableCont > table > tbody";

  // If the specific selector fails, fall back to the more general one
  const tableRows = $(tableSelector).find('tr').length > 0
    ? $(tableSelector).find('tr')
    : $('table.profile-table:contains("Rating") tr');

  tableRows.each((i, elem) => {
    const cells = $(elem).find('td');

    if (cells.length >= 7) {
      // Extract all values, replacing non-breaking spaces and trimming
      const rawValues = cells.map((_, cell) => $(cell).text().replace(/\u00A0/g, '').trim()).get();

      const entry = {
        period: rawValues[0],
        classical_rating: parseInt(rawValues[1] || '0', 10) || 0,
        classical_games: parseInt(rawValues[2] || '0', 10) || 0,
        rapid_rating: parseInt(rawValues[3] || '0', 10) || 0,
        rapid_games: parseInt(rawValues[4] || '0', 10) || 0,
        blitz_rating: parseInt(rawValues[5] || '0', 10) || 0,
        blitz_games: parseInt(rawValues[6] || '0', 10) || 0,
        date: fideToNumericDate(rawValues[0]),
      };

      history.push(entry);
    }
  });

  return history;
}

export function get_player_info(htmlDoc: string): PlayerInfo | null {
  const $ = cheerio.load(htmlDoc);
  
  // Group selectors by category for better organization
  const selectors = {
    // Basic info
    basicInfo: {
      fide_id: ".profile-info-id",
      title: ".profile-info-title",
      country: ".profile-info-country",
      birth_year: ".profile-info-byear",
      sex: ".profile-info-sex",
      name: ".player-title",
      rating: ".profile-top-rating-data"
    },
    // Rankings
    rankings: {
      world: {
        active: ".profile-rank-block:nth-of-type(1) .profile-rank-row:nth-of-type(1) p",
        all: ".profile-rank-block:nth-of-type(1) .profile-rank-row:nth-of-type(2) p"
      },
      national: {
        active: ".profile-rank-block:nth-of-type(2) .profile-rank-row:nth-of-type(1) p",
        all: ".profile-rank-block:nth-of-type(2) .profile-rank-row:nth-of-type(2) p"
      },
      continental: {
        active: ".profile-rank-block:nth-of-type(3) .profile-rank-row:nth-of-type(1) p",
        all: ".profile-rank-block:nth-of-type(3) .profile-rank-row:nth-of-type(2) p"
      }
    }
  };

  // Helper functions with improved error handling
  const getText = (selector: string): string => {
    const element = $(selector);
    return element.length > 0 ? element.text().trim() : '';
  };

  const getNumber = (selector: string): number | null => {
    const text = getText(selector);
    // Check for valid number format
    return text && /^\d+$/.test(text) ? parseInt(text, 10) : null;
  };

  // Check if this is a valid player profile
  const name = getText(selectors.basicInfo.name);
  const fideId = getText(selectors.basicInfo.fide_id);
  
  // If critical player data is missing, return null
  if (!name || !fideId) {
    return null;
  }

  // Extract data using the helper functions
  const playerInfo: PlayerInfo = {
    fide_id: fideId,
    name: name,
    title: getText(selectors.basicInfo.title),
    country: getText(selectors.basicInfo.country),
    birth_year: getNumber(selectors.basicInfo.birth_year),
    rating: getNumber(selectors.basicInfo.rating) || 0,
    sex: getText(selectors.basicInfo.sex) || null,
    
    // Rankings
    world_rank_active: getNumber(selectors.rankings.world.active),
    world_rank_all: getNumber(selectors.rankings.world.all),
    national_rank_active: getNumber(selectors.rankings.national.active),
    national_rank_all: getNumber(selectors.rankings.national.all),
    continental_rank_active: getNumber(selectors.rankings.continental.active),
    continental_rank_all: getNumber(selectors.rankings.continental.all),
  };

  // Calculate age if birth year is available
  if (playerInfo.birth_year) {
    playerInfo.age = new Date().getFullYear() - playerInfo.birth_year;
  }

  return playerInfo;
}


