import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'https://api.elevenlabs.io/v1';

async function loadDotEnv() {
  const envPath = path.join(__dirname, '.env.local');

  try {
    const contents = await fs.readFile(envPath, 'utf8');
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const equalsIndex = line.indexOf('=');
      if (equalsIndex === -1) continue;

      const key = line.slice(0, equalsIndex).trim();
      let value = line.slice(equalsIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      throw error;
    }
  }
}

const tasks = [
  {
    id: 'archbishop-roy-e-brown-way',
    texts: [
      'Coming up next on KYB Radio, it\'s Archbishop Roy E. Brown in Bushwick. Stay with us for a gospel voice that still carries the block.',
      'Up next from Brooklyn, Archbishop Roy E. Brown. A voice of faith, and a sound that still fills the room.',
      'This next one is for Bushwick and Archbishop Roy E. Brown, a singer whose sound left a real mark on the neighborhood.',
      'Time for a longer one on KYB Radio. Roy E. Brown moved to New York at thirteen, and his voice got noticed almost immediately at John Jay High School. He never stopped singing, he just added churches, founding Pilgrim Assemblies International in 1990 and growing it from Brooklyn across the Caribbean, South America, and West Africa. Here he is with the Pilgrim Tabernacle Choir, from Archbishop Roy E. Brown Way in Bushwick. This is Forever.'
    ]
  },
  {
    id: 'bob-marley-boulevard',
    texts: [
      'From Brooklyn, it\'s Bob Marley Boulevard. Next up, a reggae classic with a message that still hits hard.',
      'Coming up next on KYB Radio: Bob Marley, from East Flatbush, bringing that unmistakable rhythm and soul.',
      'This next track brings us to Bob Marley Boulevard, where reggae and memory meet in the heart of Brooklyn.',
      'Here\'s a little story with your music. Could You Be Loved came out in 1980 on Uprising, the last album Bob Marley released in his lifetime, and you can hear him reaching straight for the dance floor, reggae built to move any crowd on earth. Brooklyn heard it loud and clear. His boulevard runs through East Flatbush, the heart of Caribbean New York, where that rhythm never left. From Bob Marley Boulevard, this is Could You Be Loved.'
    ]
  },
  {
    id: 'christopher-wallace-way',
    texts: [
      'Next up, Christopher Wallace, the Notorious B.I.G., from Clinton Hill. This one is a Brooklyn landmark in sound.',
      'We\'re rolling into Brooklyn with Christopher Wallace, a voice that changed the city and the culture.',
      'From Clinton Hill, this next one is for Christopher Wallace, a New York story that still echoes.',
      'Story time on KYB. Juicy opens with a dream, but it\'s really a map of St. James Place, the magazine posters on the wall, the whole neighborhood watching a kid come up. The beat flips Mtume\'s Juicy Fruit, and here\'s my favorite part: Biggie\'s mother always insisted the hard-luck details were exaggerated. Miss Wallace swore they never once had sardines for dinner. Rappers embellish. Mothers keep receipts. From Christopher Wallace Way in Clinton Hill, this is Juicy.'
    ]
  },
  {
    id: 'billie-holiday-place',
    texts: [
      'Coming up next, Billie Holiday Place in Harlem. A voice like smoke, a feeling like memory, and a song that never lets go.',
      'Next from Manhattan, Billie Holiday. One of the great voices of Harlem and one of the great voices of American music.',
      'This next one is for Billie Holiday Place, where the sound of Harlem turns into something timeless.',
      'A quick story before this one. Billie Holiday said God Bless the Child grew out of a real argument, the day she asked her mother for money and got turned down. The phrase she snapped back became the title, and in 1941 she and Arthur Herzog turned a family quarrel into an American standard. That is the alchemy of Lady Day: private hurt, universal song. From Billie Holiday Place in Harlem, God Bless the Child.'
    ]
  },
  {
    id: 'duke-ellington-circle',
    texts: [
      'From the heart of Harlem, next up is Duke Ellington Circle. A bandleader, a genius, a New York sound.',
      'Up next from Manhattan, Duke Ellington. This one swings with the city itself.',
      'This next track is for Duke Ellington Circle, where jazz, elegance, and New York culture all meet.',
      'Deep cut trivia on KYB. Take the A Train wasn\'t written by Duke Ellington at all. It\'s by his writing partner Billy Strayhorn, and the title came from the subway directions Duke gave him to reach his place in Harlem: take the A train to Sugar Hill. When a 1941 radio dispute kept Ellington\'s own songs off the air, Strayhorn\'s tune stepped in as the band\'s theme, and it never gave the job back. From Duke Ellington Circle, next stop, Harlem.'
    ]
  },
  {
    id: 'joey-ramone-place',
    texts: [
      'Up next in Manhattan, Joey Ramone Place. Punk, speed, and the East Village edge of the Bowery.',
      'Coming up next, Joey Ramone, a New York voice with a fearless sound and a street-level attitude.',
      'This next one is for Joey Ramone Place, where the Bowery meets a fast, unforgettable rhythm.',
      'Little punk rock history for you. I Wanna Be Sedated was born at Christmas 1977, when the Ramones were stuck in London with the whole city closed for the holiday. No shows to play, nothing open, so Joey turned pure boredom into two and a half perfect minutes. And by the way, the Joey Ramone Place sign became one of the most stolen signs in New York, so the city mounted it way up out of reach. Even his street sign can\'t behave. This is the Ramones.'
    ]
  },
  {
    id: 'leonard-bernstein-place',
    texts: [
      'From Manhattan, next up is Leonard Bernstein Place. A conductor, a composer, and a New York original.',
      'Coming up next on KYB Radio, Leonard Bernstein. Big ideas, big sound, and a whole lot of New York energy.',
      'This next track is for Leonard Bernstein Place, where classical music and city imagination meet.',
      'Funny thing about this next piece. Candide flopped when it opened on Broadway in 1956, closing after just seventy-three performances. But the overture escaped the wreckage and became one of the most performed concert openers in the world. And here\'s the beautiful part: when the New York Philharmonic plays it in Bernstein\'s memory, they often perform it with no conductor at all, the whole orchestra flying on muscle memory and love. From Leonard Bernstein Place, the Overture to Candide.'
    ]
  },
  {
    id: 'louis-armstrong-place',
    texts: [
      'Next up in Queens, Louis Armstrong Place. A trumpet voice that could light a room and lift a whole neighborhood.',
      'From Queens, it\'s Louis Armstrong. One of the great voices of the twentieth century and a New York legend.',
      'This next one is for Louis Armstrong Place, where jazz and Queens history meet in a beautiful way.',
      'Here\'s a story that still amazes me. When Louis Armstrong recorded What a Wonderful World in 1967, his own label barely promoted it, and it went nowhere in America while hitting number one in Britain. It took a movie soundtrack twenty years later to make it his signature song at home. And through all of it, Satchmo stayed in the same modest house in Corona, Queens, from 1943 on. You can still visit it today. From Louis Armstrong Place, What a Wonderful World.'
    ]
  },
  {
    id: 'woody-guthrie-way',
    texts: [
      'From Brooklyn, next up is Woody Guthrie Way. A songwriter of the people, and a voice of the road.',
      'Coming up next on KYB Radio, Woody Guthrie. A New York story with roots in folk, movement, and memory.',
      'This next cut is for Woody Guthrie Way, a song for the city and for everyone moving through it.',
      'A little folk history with this one. Woody Guthrie wrote This Land Is Your Land in February 1940, in a cheap hotel room near Times Square, worn out from hearing God Bless America on every radio he passed. His first draft even had a different refrain: God blessed America for me. A few years later he was a Coney Island man, filling notebooks on Mermaid Avenue. From Woody Guthrie Way, this land is your land, Brooklyn.'
    ]
  },
  {
    id: 'harry-warren-way',
    texts: [
      'Coming up next from Bensonhurst, Harry Warren Way. A Brooklyn songwriter behind some unforgettable American melodies.',
      'Up next on KYB Radio, Harry Warren, a great songwriter with a sound that traveled far beyond the block.',
      'This next one is for Harry Warren Way, where Brooklyn songwriting meets the golden age of popular music.',
      'My favorite kind of story: the famous unknown. Harry Warren was born Salvatore Antonio Guaragna in Brooklyn, wrote close to seven hundred songs, and won three Academy Awards, yet hardly anyone can put a face to his name. One more thing: Chattanooga Choo Choo was such a smash in 1941 that the label sprayed a copy of the record gold to celebrate, the very first gold record ever presented. From Harry Warren Way in Bensonhurst, all aboard.'
    ]
  },
  {
    id: 'randy-weston-way',
    texts: [
      'From Clinton Hill, next up is Randy Weston Way. A pianist with Brooklyn rhythm and a global jazz imagination.',
      'Coming up next, Randy Weston, bringing deep roots, wide horizons, and a beautiful New York sound.',
      'This next track is for Randy Weston Way, where Brooklyn and the world meet in jazz.',
      'A quick word on the man himself. Randy Weston stood well over six and a half feet tall, and he liked to say Hi-Fly was about exactly that, how the world looks from way up there. A Brooklyn kid from these blocks, he later spent years in Morocco, folding Gnawa trance rhythms into his piano until Africa and Brooklyn sounded like one continuous conversation. From Randy Weston Way in Clinton Hill, this is Hi-Fly.'
    ]
  },
  {
    id: 'reverend-timothy-wright-way',
    texts: [
      'Next up from Crown Heights, Reverend Timothy Wright Way. Gospel power, neighborhood spirit, and a voice of faith.',
      'Coming up next on KYB Radio, Reverend Timothy Wright, a Brooklyn gospel voice that lifted the room.',
      'This next one is for Reverend Timothy Wright Way, where gospel and community sing together.',
      'Here\'s what makes this next voice special. Reverend Timothy Wright pastored his own church in Crown Heights full time, and still built a national gospel career on the side, founding the Timothy Wright Concert Choir back in 1976. His recording of Come Thou Almighty King climbed into Billboard\'s gospel top twenty and earned him a Grammy nomination. Sunday sermons and chart records, same man, same corner. From Reverend Timothy Wright Way, Trouble Don\'t Last Always.'
    ]
  },
  {
    id: 'dorothy-maynor-place',
    texts: [
      'From Hamilton Heights, next up is Dorothy Maynor Place. A remarkable voice and a Harlem story in full flight.',
      'Coming up next, Dorothy Maynor, one of the great singers to emerge from the sound of Harlem.',
      'This next track is for Dorothy Maynor Place, where classical music and neighborhood history meet.',
      'Let me tell you about this voice. In 1939, Dorothy Maynor auditioned for the great conductor Serge Koussevitzky, who was so stunned he called her a miracle on the spot. But because she was Black, no major American opera company would put her on its stage. So she built her own: the Harlem School of the Arts, founded in 1964 in a church basement, still teaching Harlem\'s kids today. From Dorothy Maynor Place, here she is in full flight.'
    ]
  },
  {
    id: 'milt-hinton-place',
    texts: [
      'Next up from Queens, Milt Hinton Place. A bass line, a bandstand, and a lifetime in jazz.',
      'From St. Albans, it is Milt Hinton, a master bassist with a sound that held the whole band together.',
      'This next one is for Milt Hinton Place, where Queens jazz history keeps the rhythm moving.',
      'Some trivia on the way in. They called Milt Hinton The Judge, and he may be the most recorded jazz musician who ever lived, more than a thousand sessions, from Cab Calloway to Sinatra to Streisand. And the whole time, he carried a camera. His candid backstage photographs, tens of thousands of them, became one of the great visual archives of jazz. In St. Albans, his neighbors included Count Basie and Ella Fitzgerald. From Milt Hinton Place, Old Man Time.'
    ]
  },
  {
    id: 'phife-dawg-way',
    texts: [
      'Coming up next from St. Albans, Phife Dawg Way. Queens energy, sharp rhymes, and a voice all his own.',
      'Up next on KYB Radio, Phife Dawg, bringing that unmistakable Queens flow and neighborhood wit.',
      'This next track is for Phife Dawg Way, where hip hop, humor, and Queens pride meet.',
      'Story time. Can I Kick It floats on a loop of Lou Reed\'s Walk on the Wild Side, and Tribe always said Reed\'s deal swallowed the money from that song whole. Expensive lesson, timeless record. Here\'s the local part: of all the streets in Queens, Phife\'s sign stands on Linden Boulevard, the same boulevard A Tribe Called Quest put on the map when they brought their video cameras home to it. From Phife Dawg Way in St. Albans, yes you can.'
    ]
  },
  {
    id: 'prodigy-way',
    texts: [
      'Next up from Queensbridge, Prodigy Way. A precise voice, a hard-earned story, and a New York sound.',
      'Coming up next, Prodigy, bringing Queensbridge perspective and a presence that still echoes.',
      'This next one is for Prodigy Way, where Queens street poetry becomes city history.',
      'A little mystery with this one. For years nobody could identify the sample behind Shook Ones Part Two. Producers hunted it like buried treasure until it turned out to be a Herbie Hancock piano piece, flipped almost beyond recognition. And Prodigy came by music honestly. His grandfather was the jazz saxophonist Budd Johnson, and his mother sang with the Crystals. Queensbridge poetry with deep, deep roots. From Prodigy Way, this is Shook Ones.'
    ]
  },
  {
    id: 'run-dmc-way',
    texts: [
      'From Hollis, next up is Run DMC Way. Adidas, attitude, and a Queens sound that changed hip hop.',
      'Coming up next on KYB Radio, Run DMC, three letters that helped put Queens on the world stage.',
      'This next track is for Run DMC Way, where rock, rap, and Hollis history come together.',
      'Here\'s a good one. In 1986, at a sold out Madison Square Garden, Run asked the crowd to hold their Adidas in the air, and thousands of sneakers went up while executives from the company watched from the seats. That moment helped land the first major sneaker deal ever given to a music act. And that guitar riff on It\'s Tricky? Borrowed straight from My Sharona. Rock and rap, one block apart. From Run DMC Way in Hollis, it\'s tricky.'
    ]
  },
  {
    id: 'big-punisher-way',
    texts: [
      'Next up from Fordham, Big Punisher Way. Big voice, sharp flow, and Bronx pride in every bar.',
      'Coming up next, Big Pun, a Bronx original with the skill and presence of a true heavyweight.',
      'This next one is for Big Punisher Way, where the Bronx speaks with rhythm and force.',
      'A word about the heavyweight. When Capital Punishment dropped in 1998, Big Pun became the first solo Latino rapper to go platinum, kicking open a door that never closed again. Fat Joe heard him rhyme in the Bronx and that was that. The man could deliver whole paragraphs without seeming to take a breath, and Still Not a Player turned all that technique into a block party. From Big Punisher Way in the Bronx, Pun and Joe.'
    ]
  },
  {
    id: 'celia-cruz-boulevard',
    texts: [
      'From Fordham, next up is Celia Cruz Boulevard. Azucar, joy, and a voice that made the whole world dance.',
      'Coming up next on KYB Radio, Celia Cruz, a Bronx icon and a giant of Latin music.',
      'This next track is for Celia Cruz Boulevard, where the Bronx meets the pulse of salsa.',
      'The story behind the shout. Celia Cruz loved to tell about the night a waiter in Miami asked if she wanted sugar in her Cuban coffee. She laughed, of course, azucar! And a catchphrase was born that followed her around the world. She recorded La Negra Tiene Tumbao in her seventies, and it won her a Grammy, seven decades into the career. Still ahead of the beat. From Celia Cruz Boulevard in the Bronx, azucar!'
    ]
  },
  {
    id: 'donald-byrd-way',
    texts: [
      'Next up from Van Nest, Donald Byrd Way. Jazz, soul, and a trumpet sound with plenty of lift.',
      'Coming up next, Donald Byrd, bringing the Bronx a bright and lasting jazz voice.',
      'This next one is for Donald Byrd Way, where jazz takes flight in the borough.',
      'Let me set this one up. In 1963, Donald Byrd walked a gospel choir into a jazz session. Cristo Redentor, written by pianist Duke Pearson, is Byrd\'s trumpet floating over voices with no words at all. Byrd was a professor too. He taught at Howard University, where his own students became the Blackbyrds. Years later, hip-hop producers sampled his records into a whole second lifetime. From Donald Byrd Way in the Bronx, lights down for this one.'
    ]
  },
  {
    id: 'hip-hop-boulevard',
    texts: [
      'From the West Bronx, next up is Hip Hop Boulevard. A street story for the culture and the city.',
      'Coming up next on KYB Radio, a sound from Hip Hop Boulevard, born in the Bronx and heard everywhere.',
      'This next track is for the West Bronx, where hip hop history still moves through the avenue.',
      'Some history for you. August 11, 1973, 1520 Sedgwick Avenue. Cindy Campbell wanted money for back to school clothes, so she threw a party in the rec room, and her brother, DJ Kool Herc, stretched the drum breaks by switching between two copies of the same record. A quarter at the door, and hip-hop was born. As for The Message, most of the Furious Five aren\'t even on it, and the group needed convincing to cut something that bleak. It became immortal anyway. From Hip Hop Boulevard, this is where it started.'
    ]
  },
  {
    id: 'johnny-pacheco-way',
    texts: [
      'Next up from Kingsbridge Heights, Johnny Pacheco Way. Salsa, rhythm, and a bandleader with a global reach.',
      'Coming up next, Johnny Pacheco, bringing Bronx energy to the heart of Latin music.',
      'This next one is for Johnny Pacheco Way, where the Bronx dances in clave.',
      'A little label history. Johnny Pacheco co-founded Fania Records in 1964, and in the early days he sold the records himself, out of the trunk of his car, to shops around the city. Within a decade, Fania owned the sound of salsa, and Pacheco was leading the Fania All Stars at the Cheetah club the night they filmed Our Latin Thing. This cut comes straight from that world. From Johnny Pacheco Way, Quitate Tu.'
    ]
  },
  {
    id: 'maxine-sullivan-way',
    texts: [
      'From Longwood, next up is Maxine Sullivan Way. A bright voice, a swing feeling, and a Bronx original.',
      'Coming up next on KYB Radio, Maxine Sullivan, with a voice that could make a melody sparkle.',
      'This next track is for Maxine Sullivan Way, where jazz history swings through Longwood.',
      'Here\'s one I love. In 1937, Maxine Sullivan took Loch Lomond, an old Scottish folk song, and swung it, and the record made her a star almost overnight. In 1940, she and her husband, bassist John Kirby, became the first Black jazz artists with their own weekly national radio show. And later she settled right here on Ritter Place, turning a house into a neighborhood music school she called The House That Jazz Built. This block was truly her block. From Maxine Sullivan Way, Loch Lomond.'
    ]
  },
  {
    id: 'ray-santos-way',
    texts: [
      'Next up from Longwood, Ray Santos Way. Arranger, saxophonist, and a deep voice in New York Latin jazz.',
      'Coming up next, Ray Santos, bringing Bronx musicianship and city rhythm to the air.',
      'This next one is for Ray Santos Way, where jazz and Latin sound share the same street.',
      'A note on the maestro. Ray Santos trained at Juilliard, then spent seven decades writing the charts behind the mambo giants: Machito, Tito Puente, Tito Rodriguez. Musicians studied his arrangements like textbooks, and they called him El Maestro. When Hollywood made The Mambo Kings, they brought in Santos to make the music real. This one is his salute to the bandleader he once played for. From Ray Santos Way in Longwood, Senor Machito.'
    ]
  },
  {
    id: 'dj-scott-la-rock-boulevard',
    texts: [
      'From Norwood, next up is DJ Scott La Rock Boulevard. Bronx roots, turntable vision, and hip hop history.',
      'Coming up next on KYB Radio, Scott La Rock, a pioneering sound from the heart of the Bronx.',
      'This next track is for DJ Scott La Rock Boulevard, where the borough helped shape the culture.',
      'The story of a partnership. Scott Sterling had a business degree and a day job as a social worker at a Bronx homeless shelter, where one of the residents was a graffiti writer calling himself KRS-One. Counselor and client became Boogie Down Productions. South Bronx was their flag in the ground, an answer record defending the borough where hip-hop was born. Scott was killed that same year, at twenty-five, trying to break up a dispute. The record keeps his name ringing. This is South Bronx.'
    ]
  },
  {
    id: 'bill-hughes-way',
    texts: [
      'Next up from Stapleton, Bill Hughes Way. A Staten Island story and a sound made for the neighborhood.',
      'Coming up next, Bill Hughes, bringing Staten Island character to KYB Radio.',
      'This next one is for Bill Hughes Way, where local history gets its own rhythm.',
      'A word on this one. Bill Hughes joined the Count Basie Orchestra on trombone in 1953 and stayed part of that band for more than sixty years. By 2003, he was leading it. Along the way he recorded with Sinatra, Ella Fitzgerald, Tony Bennett, and Sarah Vaughan. And Corner Pocket, the tune you\'re about to hear, was written by Freddie Green, Basie\'s legendary rhythm guitarist. The title is a pool shot. Rack them up. From Bill Hughes Way in Stapleton.'
    ]
  },
  {
    id: 'eric-dixon-way',
    texts: [
      'From Stapleton, next up is Saxophonist Eric R. Dixon Way. A Staten Island voice with jazz in the air.',
      'Coming up next on KYB Radio, Eric Dixon, bringing saxophone, soul, and borough pride.',
      'This next track is for Eric Dixon Way, where Staten Island finds its groove.',
      'Here\'s a neighborhood fact I love. Eric Dixon was gigging professionally on saxophone at fifteen, then spent thirty-two years with the Count Basie Orchestra, rising to musical director. And just a few blocks from his corner in Stapleton, there\'s a street for Bill Hughes, who sat in that very same band. One Staten Island neighborhood, two chairs in the greatest big band in America. This one comes from Dixon\'s own sextet. From Eric Dixon Way, Eric\'s Edge.'
    ]
  },
  {
    id: 'wu-tang-clan-district',
    texts: [
      'Next up from Stapleton, Wu-Tang Clan District. Staten Island sound, sharp minds, and a worldwide legacy.',
      'Coming up next, Wu-Tang Clan, a Staten Island force that changed the language of hip hop.',
      'This next one is for Wu-Tang Clan District, where the city gets raw, original, and unforgettable.',
      'Some business history with your beats. When Wu-Tang Clan signed their record deal in 1992, they demanded something unheard of: every member stayed free to sign solo deals with any label they wanted. The industry blinked first, and that clause built an empire. Cream itself rides a soul loop from a sixties group called the Charmels, flipped into the coldest economics lesson in hip-hop. From the Wu-Tang Clan District, Staten Island, forever Shaolin. Cash rules.'
    ]
  }
];

function parseArgs(argv) {
  const args = { dryRun: false, listVoices: false, skipExisting: false, task: null, voice: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    if (arg === '--list-voices') args.listVoices = true;
    if (arg === '--skip-existing') args.skipExisting = true;
    if (arg === '--voice' && argv[i + 1]) {
      args.voice = argv[i + 1];
      i += 1;
    }
    if (arg === '--task' && argv[i + 1]) {
      args.task = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

async function fetchVoices(apiKey) {
  const res = await fetch(`${API_BASE}/voices`, {
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch voices: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.voices || [];
}

async function resolveVoiceId({ apiKey, preferredName, explicitId }) {
  if (explicitId) return explicitId;

  const voiceName = preferredName || process.env.ELEVENLABS_VOICE_NAME;
  if (!voiceName) {
    throw new Error('Missing voice selection. Set ELEVENLABS_VOICE_ID, or set ELEVENLABS_VOICE_NAME / --voice to a voice like Daniel or Josh.');
  }

  const voices = await fetchVoices(apiKey);
  const match = voices.find((voice) => {
    const normalized = `${voice.name || ''}`.trim().toLowerCase();
    return normalized === voiceName.trim().toLowerCase();
  });

  if (!match) {
    const options = voices.map((voice) => voice.name).slice(0, 10).join(', ');
    throw new Error(`Voice not found: "${voiceName}". Available voices: ${options || 'none'}.`);
  }

  return match.voice_id;
}

async function getEnv(preferredName) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ELEVENLABS_API_KEY. Put it in website/radio/announcer/.env.local or your shell environment.');
  }

  const voiceId = await resolveVoiceId({
    apiKey,
    preferredName,
    explicitId: process.env.ELEVENLABS_VOICE_ID
  });

  return { apiKey, voiceId };
}

async function listVoices(apiKey) {
  const voices = await fetchVoices(apiKey);

  for (const voice of voices) {
    console.log(`${voice.name} | ${voice.voice_id}`);
  }
}

async function generateSpeech({ apiKey, voiceId, text, outputPath }) {
  const response = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
        style: 0.3,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs generation failed for text: ${response.status} ${body}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}

async function main() {
  await loadDotEnv();
  const args = parseArgs(process.argv.slice(2));

  if (args.listVoices) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('Missing ELEVENLABS_API_KEY. Put it in website/radio/announcer/.env.local or your shell environment.');
    }
    await listVoices(apiKey);
    return;
  }

  const { apiKey, voiceId } = await getEnv(args.voice);

  const selectedTasks = args.task ? tasks.filter((task) => task.id === args.task) : tasks;

  if (!selectedTasks.length) {
    throw new Error(`No task matched: ${args.task || 'none'}`);
  }

  for (const task of selectedTasks) {
    for (const [index, text] of task.texts.entries()) {
      const outputName = `${task.id}-${String(index + 1).padStart(2, '0')}.mp3`;
      const outputPath = path.join(__dirname, outputName);

      if (args.skipExisting) {
        try {
          await fs.access(outputPath);
          console.log(`Skipping existing ${outputName}`);
          continue;
        } catch (error) {
          if (error && error.code !== 'ENOENT') throw error;
        }
      }

      if (args.dryRun) {
        console.log(`[dry-run] ${outputName} :: ${text}`);
        continue;
      }

      await generateSpeech({ apiKey, voiceId, text, outputPath });
      console.log(`Generated ${outputName}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
