/**
 * Fuente única de verdad para los géneros de Beatport y sus URLs.
 * Todos los scrapers y endpoints deben importar desde aquí.
 */

const BEATPORT_GENRES = {
    // Electronic - House y subgéneros
    'house': 'https://www.beatport.com/genre/house/5/top-100',
    'deep-house': 'https://www.beatport.com/genre/deep-house/12/top-100',
    'tech-house': 'https://www.beatport.com/genre/tech-house/11/top-100',
    'progressive-house': 'https://www.beatport.com/genre/progressive-house/15/top-100',
    'afro-house': 'https://www.beatport.com/genre/afro-house/89/top-100',
    'bass-house': 'https://www.beatport.com/genre/bass-house/91/top-100',
    'funky-house': 'https://www.beatport.com/genre/funky-house/81/top-100',
    // 'jackin-house': 'https://www.beatport.com/genre/jackin-house/81/top-100',
    'melodic-house-techno': 'https://www.beatport.com/genre/melodic-house-techno/90/top-100',
    'organic-house': 'https://www.beatport.com/genre/organic-house/93/top-100',

    // Electronic - Techno y subgéneros
    'techno': 'https://www.beatport.com/genre/techno/6/top-100',
    'peak-time-driving-techno': 'https://www.beatport.com/genre/peak-time-driving-techno/2/top-100',
    'raw-deep-hypnotic-techno': 'https://www.beatport.com/genre/raw-deep-hypnotic-techno/3/top-100',
    'hard-techno': 'https://www.beatport.com/genre/hard-techno/31/top-100',
    'minimal-deep-tech': 'https://www.beatport.com/genre/minimal-deep-tech/14/top-100',

    // Electronic - Trance y subgéneros
    'trance': 'https://www.beatport.com/genre/trance/7/top-100',
    'psy-trance': 'https://www.beatport.com/genre/psy-trance/13/top-100',
    'trance-raw-deep-hypnotic': 'https://www.beatport.com/genre/trance-raw-deep-hypnotic/132/top-100',

    // Electronic - Bass music
    'drum-bass': 'https://www.beatport.com/genre/drum-bass/1/top-100',
    'dubstep': 'https://www.beatport.com/genre/dubstep/18/top-100',
    'trap-future-bass': 'https://www.beatport.com/genre/trap-future-bass/87/top-100',
    'bass-club': 'https://www.beatport.com/genre/bass-club/147/top-100',
    'deep-dubstep-grime': 'https://www.beatport.com/genre/deep-dubstep-grime/140/top-100',

    // Electronic - Garage y Breakbeat
    'uk-garage-bassline': 'https://www.beatport.com/genre/uk-garage-bassline/86/top-100',
    'breaks-breakbeat-uk-bass': 'https://www.beatport.com/genre/breaks-breakbeat-uk-bass/9/top-100',

    // Electronic - Hardcore y Hard Dance
    'hard-dance-hardcore': 'https://www.beatport.com/genre/hard-dance-hardcore/8/top-100',

    // Electronic - Ambient y Downtempo
    'ambient-experimental': 'https://www.beatport.com/genre/ambient-experimental/19/top-100',
    'downtempo': 'https://www.beatport.com/genre/downtempo/10/top-100',
    'electronica': 'https://www.beatport.com/genre/electronica/20/top-100',

    // Electronic - Indie y Nu Disco
    'indie-dance': 'https://www.beatport.com/genre/indie-dance/37/top-100',
    'nu-disco-disco': 'https://www.beatport.com/genre/nu-disco-disco/50/top-100',

    // Electronic - Electro y Mainstage
    'electro': 'https://www.beatport.com/genre/electro/52/top-100',
    'mainstage': 'https://www.beatport.com/genre/mainstage/79/top-100',

    // Electronic - Dance y Pop
    'dance-pop': 'https://www.beatport.com/genre/dance-pop/39/top-100',

    // Electronic - DJ Tools
    'dj-tools': 'https://www.beatport.com/genre/dj-tools/16/top-100',

    // Electronic - Géneros emergentes
    'amapiano': 'https://www.beatport.com/genre/amapiano/152/top-100',
    'brazilian-funk': 'https://www.beatport.com/genre/brazilian-funk/127/top-100',

    // Open Format - Géneros diversos
    'african': 'https://www.beatport.com/genre/african/65/top-100',
    'caribbean': 'https://www.beatport.com/genre/caribbean/66/top-100',
    'hip-hop': 'https://www.beatport.com/genre/hip-hop/38/top-100',
    'latin': 'https://www.beatport.com/genre/latin/61/top-100',
    'pop': 'https://www.beatport.com/genre/pop/35/top-100',
    'rnb': 'https://www.beatport.com/genre/rnb/36/top-100',
};

module.exports = { BEATPORT_GENRES };
