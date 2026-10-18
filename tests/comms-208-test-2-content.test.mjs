import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../tools/comms-208-test-2-2026.html', import.meta.url), 'utf8');

function decodeHtml(value) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&uuml;/g, 'ü')
        .replace(/&amacr;/g, 'ā')
        .replace(/&apos;|&#39;/g, "'")
        .replace(/&ldquo;|&rdquo;/g, '"')
        .replace(/&rsquo;|&lsquo;/g, '’')
        .replace(/&mdash;/g, '—')
        .replace(/&nbsp;/g, ' ')
        .replace(/&([a-z]+);/gi, '')
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function readingLists(sectionId) {
    const section = html.match(new RegExp(`<section[^>]*id="${sectionId}"[\\s\\S]*?<\\/section>`))?.[0];
    assert.ok(section, `missing ${sectionId}`);
    return [...section.matchAll(/<div>\s*<h3[^>]*>([\s\S]*?)<\/h3>\s*<ol([^>]*)>([\s\S]*?)<\/ol>\s*<\/div>/g)]
        .map(([, title, attributes, list]) => ({
            title: decodeHtml(title.replace(/<[^>]+>/g, '')).trim(),
            start: Number(attributes.match(/\bstart="(\d+)"/)?.[1] ?? 1),
            items: [...list.matchAll(/<li class="flex items-start gap-2"><span class="read-num"[^>]*>(\d+)<\/span><span class="text-xs md:text-sm leading-snug">([\s\S]*?)<\/span><\/li>/g)]
                .map(([, number, name]) => [Number(number), decodeHtml(name.replace(/<[^>]+>/g, '')).trim()]),
        }));
}

test('Test 2 reading slide matches the PDF wording, order, and numbering', () => {
    const expected = [
        [1, 'AI Essentials Canvas Course (UoA)'],
        [2, 'Anatomy of an AI System (Crawford & Joler)'],
        [3, 'Benefits of AI in healthcare for Aotearoa NZ: Summary (PMCSA)'],
        [4, 'Physiognomy’s New Clothes (Agüera y Arcas, et al.)'],
        [5, 'AI Ethics: Seven Traps (Zimmermann & Zevenbergen)'],
        [6, 'Principles of Māori Data Sovereignty (Te Mana Raraunga)'],
        [7, 'Data Feminism: The Power Chapter (D’Ignazio & Klein)'],
        [8, 'Ethics & Info. Technology (Johnson & Miller)'],
        [9, 'Plagiarism and Copyright Infringement (Murray)'],
        [10, 'IP and Confucianism (Yu)'],
        [11, 'Milestones in the History of Info. and Computer Ethics (Bynum)'],
        [12, 'A Moral Panic: ChatGPT & the Gamification of Ed. (Kennedy)'],
        [13, 'Contra Literacy-Laundering: Mechanistic Critical AI Literacy (Ray & Guest)'],
        [14, 'Contestation of Tech Ethics (Green)'],
        [15, 'Political Effects of the Internet and Social Media (Zhuravskaya et al.)'],
        [16, 'Algorithmic Decision-Making And Accountability Case Study (Kirchner / Stanford U.)'],
        [17, 'AI Making Benefit Decisions (Keall)'],
        [18, 'Bigger Brother (Tim Wu review of Zuboff)'],
        [19, 'The Coup We Are Not Talking About (Zuboff/NYT)'],
        [20, 'Will AI Take My Job? With Karen Hao (Minhaj)'],
        [21, 'Deepfakes & Democracy (Benn)'],
        [22, 'Chapter 16: Algorithmic Colonization of Africa (Birhane)'],
        [23, 'Yellow Techno-Peril: The \'Clash of Civilizations\' and Anti-Chinese Racial Rhetoric in the US-China AI Arms Race (Kerry McInerney)'],
        [24, 'AI is trash (Anne Pasek)'],
        [25, 'A New AI Lexicon: Maintenance (Anna Pendergrast and Kelly Pendergrast)'],
    ];
    assert.deepEqual(readingLists('slide-2'), [
        { title: 'New Reading List (Weeks 7-11)', start: 15, items: expected.slice(14) },
        { title: 'Old Reading List (Weeks 1-5)', start: 1, items: expected.slice(0, 14) },
    ]);
});

test('Test 2 instructions match the PDF wording', () => {
    const section = html.match(/<section[^>]*id="slide-1"[\s\S]*?<\/section>/)?.[0];
    assert.ok(section, 'missing slide-1');
    const text = decodeHtml(section.replace(/<[^>]+>/g, '').replace(/\s+/g, ' '));
    assert.ok(text.includes('PLEASE:'), 'PLEASE heading needs the PDF colon');
    assert.ok(text.includes('Then➜ Leave your bag at the front of the class'));
    assert.ok(text.includes('Then➜ Each student may take ONE test'));
});
