import { NextRequest, NextResponse } from 'next/server';
import { getCurrentNFLWeek } from '@/lib/utils';
import { gameCacheService } from '@/lib/firebase-service';

// Team name mappings for matching
const TEAM_NAMES = [
  'Packers', 'Chiefs', 'Patriots', 'Rams', 'Chargers', 'Giants', 'Jets',
  '49ers', 'Raiders', 'Buccaneers', 'Bills', 'Dolphins', 'Jaguars', 'Titans',
  'Colts', 'Texans', 'Broncos', 'Steelers', 'Browns', 'Ravens', 'Bengals',
  'Vikings', 'Lions', 'Bears', 'Eagles', 'Cowboys', 'Commanders', 'Seahawks',
  'Cardinals', 'Falcons', 'Panthers', 'Saints'
];

const FULL_TEAM_NAMES: Record<string, string> = {
  'Green Bay Packers': 'Packers',
  'Kansas City Chiefs': 'Chiefs',
  'New England Patriots': 'Patriots',
  'Los Angeles Rams': 'Rams',
  'Los Angeles Chargers': 'Chargers',
  'New York Giants': 'Giants',
  'New York Jets': 'Jets',
  'San Francisco 49ers': '49ers',
  'Las Vegas Raiders': 'Raiders',
  'Tampa Bay Buccaneers': 'Buccaneers',
  'Buffalo Bills': 'Bills',
  'Miami Dolphins': 'Dolphins',
  'Jacksonville Jaguars': 'Jaguars',
  'Tennessee Titans': 'Titans',
  'Indianapolis Colts': 'Colts',
  'Houston Texans': 'Texans',
  'Denver Broncos': 'Broncos',
  'Pittsburgh Steelers': 'Steelers',
  'Cleveland Browns': 'Browns',
  'Baltimore Ravens': 'Ravens',
  'Cincinnati Bengals': 'Bengals',
  'Minnesota Vikings': 'Vikings',
  'Detroit Lions': 'Lions',
  'Chicago Bears': 'Bears',
  'Philadelphia Eagles': 'Eagles',
  'Dallas Cowboys': 'Cowboys',
  'Washington Commanders': 'Commanders',
  'Seattle Seahawks': 'Seahawks',
  'Arizona Cardinals': 'Cardinals',
  'Atlanta Falcons': 'Falcons',
  'Carolina Panthers': 'Panthers',
  'New Orleans Saints': 'Saints'
};

async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  // Use OpenAI Vision API for OCR
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const base64Image = imageBuffer.toString('base64');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract all text from this betting slip image. Return ONLY the raw text content, preserving line breaks and structure. Do not interpret or summarize, just extract the text exactly as it appears.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

async function parseBetFromText(text: string, currentWeek: number): Promise<any> {
  // Use OpenAI to parse the extracted text into structured bet data
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a betting slip parser. Extract bet information from text and return JSON with:
- teams: array of two team names found
- betType: "spread", "over_under", "moneyline", or "player_prop"
- selection: the bet selection (e.g., "Packers -3", "Over 45.5", "Chiefs ML")
- line: the line number if applicable (spread or over/under)
- odds: the odds as a number (e.g., -110, +150)
- amount: the bet amount if visible

Return ONLY valid JSON, no other text. If information is missing, use null.`
        },
        {
          role: 'user',
          content: `Extract bet information from this text:\n\n${text}`
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0]?.message?.content || '{}');
}

async function findGameByTeams(team1: string, team2: string, week: number): Promise<any> {
  // Try to find the game in Firebase cache
  const weekendId = `2025-week-${week}`;
  const cachedData = await gameCacheService.getCachedGames(weekendId);
  
  if (!cachedData?.games) {
    return null;
  }

  // Normalize team names
  const normalizeTeam = (name: string): string => {
    // Try full name first
    if (FULL_TEAM_NAMES[name]) {
      return FULL_TEAM_NAMES[name];
    }
    // Try short name
    for (const [full, short] of Object.entries(FULL_TEAM_NAMES)) {
      if (full.toLowerCase().includes(name.toLowerCase()) || 
          name.toLowerCase().includes(short.toLowerCase())) {
        return short;
      }
    }
    return name;
  };

  const norm1 = normalizeTeam(team1);
  const norm2 = normalizeTeam(team2);

  // Find game where both teams match
  const game = cachedData.games.find(g => {
    const homeNorm = normalizeTeam(g.homeTeam);
    const awayNorm = normalizeTeam(g.awayTeam);
    return (
      (homeNorm === norm1 && awayNorm === norm2) ||
      (homeNorm === norm2 && awayNorm === norm1)
    );
  });

  return game;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('📸 Extracting text from image...');
    
    // Step 1: Extract text from image
    const extractedText = await extractTextFromImage(buffer);
    console.log('📝 Extracted text:', extractedText);

    // Step 2: Parse bet information from text
    const currentWeek = getCurrentNFLWeek();
    const parsedBet = await parseBetFromText(extractedText, currentWeek);
    console.log('🎲 Parsed bet:', parsedBet);

    if (!parsedBet.teams || parsedBet.teams.length < 2) {
      return NextResponse.json({
        extractedText,
        error: 'Could not identify teams in the betting slip'
      }, { status: 400 });
    }

    // Step 3: Find the game
    const game = await findGameByTeams(parsedBet.teams[0], parsedBet.teams[1], currentWeek);
    
    if (!game) {
      return NextResponse.json({
        extractedText,
        parsedBet,
        error: `Could not find game between ${parsedBet.teams[0]} and ${parsedBet.teams[1]} for Week ${currentWeek}`
      }, { status: 404 });
    }

    // Step 4: Build bet data
    const betData = {
      gameId: game.id,
      weekendId: game.weekendId || `2025-week-${currentWeek}`,
      betType: parsedBet.betType || 'moneyline',
      selection: parsedBet.selection || `${parsedBet.teams[0]} vs ${parsedBet.teams[1]}`,
      odds: parsedBet.odds || -110,
      line: parsedBet.line,
      totalAmount: parsedBet.amount ? parsedBet.amount * 100 : 200, // Convert to cents
      amountPerPerson: parsedBet.amount ? parsedBet.amount * 100 : 200,
    };

    return NextResponse.json({
      success: true,
      extractedText,
      parsedBet,
      betData,
    });

  } catch (error) {
    console.error('❌ Error extracting bet from image:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process image',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
