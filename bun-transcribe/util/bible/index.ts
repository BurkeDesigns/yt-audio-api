function rangeToArray(input: string) {
    // Check if input includes a dash, indicating a range
    if (input.includes('-')) {
        // Split the range into start and end numbers
        const [start, end] = input.split('-').map(Number);
        // Generate an array of numbers from start to end, inclusive
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    } else {
        // If not a range, convert input to a single-element array
        return [Number(input)];
    }
}

export function extractBibleRefs(text: string) {
    // Map of book abbreviations and names to their standard names
    const bookNameMap: { [key: string]: string } = {
        'Genesis': 'Genesis', 'Gen': 'Genesis', 'Ge': 'Genesis',
        'Exodus': 'Exodus', 'Ex': 'Exodus',
        'Leviticus': 'Leviticus', 'Lev': 'Leviticus',
        'Numbers': 'Numbers', 'Num': 'Numbers', 'Nm': 'Numbers',
        'Deuteronomy': 'Deuteronomy', 'Deut': 'Deuteronomy', 'Dt': 'Deuteronomy',
        'Joshua': 'Joshua', 'Josh': 'Joshua', 'Jos': 'Joshua',
        'Judges': 'Judges', 'Judg': 'Judges', 'Jdg': 'Judges',
        'Ruth': 'Ruth', 'Ru': 'Ruth',
        '1 Samuel': '1 Samuel', 'I Samuel': '1 Samuel', '1Sam': '1 Samuel', '1 Sa': '1 Samuel',
        '2 Samuel': '2 Samuel', 'II Samuel': '2 Samuel', '2Sam': '2 Samuel', '2 Sa': '2 Samuel',
        '1 Kings': '1 Kings', 'I Kings': '1 Kings', '1Kgs': '1 Kings', '1 Ki': '1 Kings',
        '2 Kings': '2 Kings', 'II Kings': '2 Kings', '2Kgs': '2 Kings', '2 Ki': '2 Kings',
        '1 Chronicles': '1 Chronicles', 'I Chronicles': '1 Chronicles', '1Chron': '1 Chronicles', '1 Ch': '1 Chronicles',
        '2 Chronicles': '2 Chronicles', 'II Chronicles': '2 Chronicles', '2Chron': '2 Chronicles', '2 Ch': '2 Chronicles',
        'Ezra': 'Ezra', 'Ezr': 'Ezra',
        'Nehemiah': 'Nehemiah', 'Neh': 'Nehemiah',
        'Esther': 'Esther', 'Esth': 'Esther', 'Est': 'Esther',
        'Job': 'Job', 'Jb': 'Job',
        'Psalms': 'Psalm', 'Psalm': 'Psalm', 'Ps': 'Psalm',
        'Proverbs': 'Proverbs', 'Prov': 'Proverbs', 'Prv': 'Proverbs',
        'Ecclesiastes': 'Ecclesiastes', 'Ecc': 'Ecclesiastes',
        'Song of Solomon': 'Song of Solomon', 'Song': 'Song of Solomon', 'So': 'Song of Solomon',
        'Isaiah': 'Isaiah', 'Isa': 'Isaiah',
        'Jeremiah': 'Jeremiah', 'Jer': 'Jeremiah',
        'Lamentations': 'Lamentations', 'Lam': 'Lamentations',
        'Ezekiel': 'Ezekiel', 'Ezek': 'Ezekiel', 'Eze': 'Ezekiel',
        'Daniel': 'Daniel', 'Dan': 'Daniel', 'Da': 'Daniel',
        'Hosea': 'Hosea', 'Hos': 'Hosea',
        'Joel': 'Joel', 'Jl': 'Joel',
        'Amos': 'Amos', 'Am': 'Amos',
        'Obadiah': 'Obadiah', 'Obad': 'Obadiah', 'Ob': 'Obadiah',
        'Jonah': 'Jonah', 'Jon': 'Jonah', 'Jnh': 'Jonah',
        'Micah': 'Micah', 'Mic': 'Micah', 'Mi': 'Micah',
        'Nahum': 'Nahum', 'Nah': 'Nahum', 'Na': 'Nahum',
        'Habakkuk': 'Habakkuk', 'Hab': 'Habakkuk', 'Hb': 'Habakkuk',
        'Zephaniah': 'Zephaniah', 'Zeph': 'Zephaniah', 'Zep': 'Zephaniah',
        'Haggai': 'Haggai', 'Hag': 'Haggai', 'Hg': 'Haggai',
        'Zechariah': 'Zechariah', 'Zech': 'Zechariah', 'Zec': 'Zechariah',
        'Malachi': 'Malachi', 'Mal': 'Malachi', 'Ml': 'Malachi',
        'Matthew': 'Matthew', 'Matt': 'Matthew', 'Mt': 'Matthew',
        'Mark': 'Mark', 'Mk': 'Mark',
        'Luke': 'Luke', 'Lk': 'Luke',
        'John': 'John', 'Jn': 'John',
        'Acts': 'Acts', 'Ac': 'Acts',
        'Romans': 'Romans', 'Rom': 'Romans', 'Ro': 'Romans',
        '1 Corinthians': '1 Corinthians', 'I Corinthians': '1 Corinthians', '1Cor': '1 Corinthians', '1 Co': '1 Corinthians',
        '2 Corinthians': '2 Corinthians', 'II Corinthians': '2 Corinthians', '2Cor': '2 Corinthians', '2 Co': '2 Corinthians',
        'Galatians': 'Galatians', 'Gal': 'Galatians', 'Ga': 'Galatians',
        'Ephesians': 'Ephesians', 'Eph': 'Ephesians', 'Ephes': 'Ephesians',
        'Philippians': 'Philippians', 'Phil': 'Philippians', 'Php': 'Philippians',
        'Colossians': 'Colossians', 'Col': 'Colossians',
        '1 Thessalonians': '1 Thessalonians', 'I Thessalonians': '1 Thessalonians', '1Thess': '1 Thessalonians', '1 Th': '1 Thessalonians',
        '2 Thessalonians': '2 Thessalonians', 'II Thessalonians': '2 Thessalonians', '2Thess': '2 Thessalonians', '2 Th': '2 Thessalonians',
        '1 Timothy': '1 Timothy', 'I Timothy': '1 Timothy', '1Tim': '1 Timothy', '1 Ti': '1 Timothy',
        '2 Timothy': '2 Timothy', 'II Timothy': '2 Timothy', '2Tim': '2 Timothy', '2 Ti': '2 Timothy',
        'Titus': 'Titus', 'Tit': 'Titus',
        'Philemon': 'Philemon', 'Philem': 'Philemon', 'Phm': 'Philemon',
        'Hebrews': 'Hebrews', 'Heb': 'Hebrews',
        'James': 'James', 'Jas': 'James', 'Jm': 'James',
        '1 Peter': '1 Peter', 'I Peter': '1 Peter', '1Pet': '1 Peter', '1 Pe': '1 Peter',
        '2 Peter': '2 Peter', 'II Peter': '2 Peter', '2Pet': '2 Peter', '2 Pe': '2 Peter',
        '1 John': '1 John', 'I John': '1 John', '1Jn': '1 John', '1 Jn': '1 John',
        '2 John': '2 John', 'II John': '2 John', '2Jn': '2 John', '2 Jn': '2 John',
        '3 John': '3 John', 'III John': '3 John', '3Jn': '3 John', '3 Jn': '3 John',
        'Jude': 'Jude', 'Jud': 'Jude', 'Jd': 'Jude',
        'Revelation': 'Revelation', 'Rev': 'Revelation', 'Re': 'Revelation',
    };

    // Create a regex pattern to match any book name or abbreviation
    const bookNameKeys = Object.keys(bookNameMap).sort((a, b) => b.length - a.length);
    const bookNamePattern = bookNameKeys.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    // Regex to match Bible references
    const regex = new RegExp(`\\b(${bookNamePattern})\\s+(\\d+)(?::(\\d+))?(?:-(\\d+)(?::(\\d+))?)?`, 'g');

    const referenceMap = new Map<string, any>();
    const flatArr: any[] = [];

    // Single pass - collect matches and build results directly
    let match;
    while ((match = regex.exec(text)) !== null) {
        const refStr = match[0];
        
        // Skip if already processed
        if (referenceMap.has(refStr)) {
            continue;
        }

        const bookName = bookNameMap[match[1]];
        const chapter = parseInt(match[2], 10);
        const verseStart = match[3] ? parseInt(match[3], 10) : null;
        const chapterOrVerseEnd = match[4] ? parseInt(match[4], 10) : null;
        const verseEnd = match[5] ? parseInt(match[5], 10) : null;

        let verses: any[] = [];

        if (verseStart !== null) {
            let verseArr = [];
            if (verseEnd !== null) {
                // Verse range like John 3:16-18
                verseArr = rangeToArray(`${verseStart}-${verseEnd}`);
            } else if (chapterOrVerseEnd !== null) {
                // Verse range like John 3:16-20
                verseArr = rangeToArray(`${verseStart}-${chapterOrVerseEnd}`);
            } else {
                // Single verse like John 3:16
                verseArr = [verseStart];
            }
            const data = { book: bookName, chapter, verses: verseArr, label: refStr };
            flatArr.push(data);
            verses.push(data);
        } else {
            // Whole chapter like John 3
            const data = { book: bookName, chapter, verses: [], label: refStr };
            flatArr.push(data);
            verses.push(data);
        }

        referenceMap.set(refStr, {
            label: refStr,
            book: bookName,
            chapter,
            verses,
        });
    }

    return {
        nested: Array.from(referenceMap.values()),
        flatArr,
    };
}

export async function getVersesFromReferenceList(bible: any, parsedRefList: any) {
    let newList: any[] = [];
    // Check if the bible object is null or undefined
    if (!bible) return newList;

    // Iterate over the parsed reference list
    parsedRefList.forEach((ref: any) => {
        // Initialize an array to store verses for the current reference
        let verses: any = [];

        // Check if the book and chapter exist in the bible object
        if (ref.book && ref.chapter && bible[ref.book] && bible[ref.book][ref.chapter]) {
            // If no specific verses are listed, get all verses in the chapter
            if (ref.verses.length === 0) {
                verses = Object.values(bible[ref.book][ref.chapter]);
            } else {
                ref.verses.forEach((verse: any) => {
                    // Check if the verse exists in the bible object for the given book and chapter
                    if (bible[ref.book][ref.chapter][verse]) {
                        verses.push(bible[ref.book][ref.chapter][verse]);
                    }
                    // If the verse doesn't exist, we skip it without interrupting the loop
                });
            }

            // Add the reference details along with the retrieved verses to the new list
            const details = {
                ...ref,
                verses,
            };
            newList.push(details);
        }
        // If the book or chapter doesn't exist, this ref is skipped
    });
    return newList;
}