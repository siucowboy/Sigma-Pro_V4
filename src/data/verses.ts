export type VerseCategory =
  | 'home-dashboard'
  | 'measurement-system-analysis'
  | 'process-capability'
  | 'control-charts-spc'
  | 'hypothesis-testing'
  | 'regression-correlation'
  | 'doe'
  | 'sample-size-power'
  | 'anova'
  | 'logistic-regression'
  | 'reporting-export';

export type Verse = {
  id: string;
  text: string;
  reference: string;
  translation: 'ESV' | 'NIV';
  category: VerseCategory;
  themes: string[];
  attributionShort: string;
  attributionFull: string;
};

const ESV_ATTRIBUTION =
  'Scripture quotations marked ESV are from The Holy Bible, English Standard Version, copyright 2001 by Crossway, a publishing ministry of Good News Publishers.';

const NIV_ATTRIBUTION =
  'Scripture quotations marked NIV are taken from The Holy Bible, New International Version, NIV. Copyright 1973, 1978, 1984, 2011 by Biblica, Inc. Used by permission. All rights reserved worldwide.';

// ESV and NIV are copyrighted translations. Keep this library modest, preserve attribution,
// and review permission/attribution requirements before adding a larger verse collection.
const verse = (
  id: string,
  text: string,
  reference: string,
  translation: Verse['translation'],
  category: VerseCategory,
  themes: string[]
): Verse => ({
  id,
  text,
  reference,
  translation,
  category,
  themes,
  attributionShort: translation,
  attributionFull: translation === 'ESV' ? ESV_ATTRIBUTION : NIV_ATTRIBUTION
});

export const verses: Verse[] = [
  {
    id: 'proverbs-18-15-esv',
    text: 'An intelligent heart acquires knowledge, and the ear of the wise seeks knowledge.',
    reference: 'Proverbs 18:15',
    translation: 'ESV',
    category: 'home-dashboard',
    themes: ['learning', 'knowledge', 'wisdom'],
    attributionShort: 'ESV',
    attributionFull: ESV_ATTRIBUTION
  },
  {
    id: 'proverbs-11-1-esv',
    text: 'A false balance is an abomination to the Lord, but a just weight is his delight.',
    reference: 'Proverbs 11:1',
    translation: 'ESV',
    category: 'measurement-system-analysis',
    themes: ['measurement', 'truth', 'accuracy', 'integrity'],
    attributionShort: 'ESV',
    attributionFull: ESV_ATTRIBUTION
  },
  {
    id: 'colossians-3-23-niv',
    text: 'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters,',
    reference: 'Colossians 3:23',
    translation: 'NIV',
    category: 'process-capability',
    themes: ['stewardship', 'diligence', 'improvement'],
    attributionShort: 'NIV',
    attributionFull: NIV_ATTRIBUTION
  },
  {
    id: 'galatians-6-9-niv',
    text: 'Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.',
    reference: 'Galatians 6:9',
    translation: 'NIV',
    category: 'control-charts-spc',
    themes: ['patience', 'consistency', 'watchfulness'],
    attributionShort: 'NIV',
    attributionFull: NIV_ATTRIBUTION
  },
  {
    id: 'first-thessalonians-5-21-esv',
    text: 'but test everything; hold fast what is good.',
    reference: '1 Thessalonians 5:21',
    translation: 'ESV',
    category: 'hypothesis-testing',
    themes: ['testing', 'discernment', 'judgment'],
    attributionShort: 'ESV',
    attributionFull: ESV_ATTRIBUTION
  },
  {
    id: 'proverbs-2-6-niv',
    text: 'For the Lord gives wisdom; from his mouth come knowledge and understanding.',
    reference: 'Proverbs 2:6',
    translation: 'NIV',
    category: 'regression-correlation',
    themes: ['understanding', 'relationships', 'insight', 'wisdom'],
    attributionShort: 'NIV',
    attributionFull: NIV_ATTRIBUTION
  },
  {
    id: 'proverbs-21-5-niv',
    text: 'The plans of the diligent lead to profit as surely as haste leads to poverty.',
    reference: 'Proverbs 21:5',
    translation: 'NIV',
    category: 'doe',
    themes: ['planning', 'design', 'diligence'],
    attributionShort: 'NIV',
    attributionFull: NIV_ATTRIBUTION
  },
  {
    id: 'luke-14-28-esv',
    text: 'For which of you, desiring to build a tower, does not first sit down and count the cost, whether he has enough to complete it?',
    reference: 'Luke 14:28',
    translation: 'ESV',
    category: 'sample-size-power',
    themes: ['preparation', 'prudence', 'counting the cost'],
    attributionShort: 'ESV',
    attributionFull: ESV_ATTRIBUTION
  },
  {
    id: 'proverbs-14-15-esv',
    text: 'The simple believes everything, but the prudent gives thought to his steps.',
    reference: 'Proverbs 14:15',
    translation: 'ESV',
    category: 'anova',
    themes: ['discernment', 'comparison', 'understanding'],
    attributionShort: 'ESV',
    attributionFull: ESV_ATTRIBUTION
  },
  {
    id: 'james-1-5-niv',
    text: 'If any of you lacks wisdom, you should ask God, who gives generously to all without finding fault, and it will be given to you.',
    reference: 'James 1:5',
    translation: 'NIV',
    category: 'logistic-regression',
    themes: ['judgment', 'choices', 'outcomes', 'wisdom'],
    attributionShort: 'NIV',
    attributionFull: NIV_ATTRIBUTION
  },
  {
    id: 'proverbs-12-17-esv',
    text: 'Whoever speaks the truth gives honest evidence, but a false witness utters deceit.',
    reference: 'Proverbs 12:17',
    translation: 'ESV',
    category: 'reporting-export',
    themes: ['truthful communication', 'clarity', 'accountability'],
    attributionShort: 'ESV',
    attributionFull: ESV_ATTRIBUTION
  },

  verse('proverbs-1-5-esv', 'Let the wise hear and increase in learning, and the one who understands obtain guidance,', 'Proverbs 1:5', 'ESV', 'home-dashboard', ['learning', 'guidance', 'wisdom']),
  verse('proverbs-2-6-niv-home', 'For the Lord gives wisdom; from his mouth come knowledge and understanding.', 'Proverbs 2:6', 'NIV', 'home-dashboard', ['wisdom', 'knowledge', 'understanding']),
  verse('proverbs-16-16-esv', 'How much better to get wisdom than gold! To get understanding is to be chosen rather than silver.', 'Proverbs 16:16', 'ESV', 'home-dashboard', ['wisdom', 'understanding', 'learning']),
  verse('james-1-5-niv-home', 'If any of you lacks wisdom, you should ask God, who gives generously to all without finding fault, and it will be given to you.', 'James 1:5', 'NIV', 'home-dashboard', ['wisdom', 'learning', 'discernment']),

  verse('proverbs-20-10-esv', 'Unequal weights and unequal measures are both alike an abomination to the Lord.', 'Proverbs 20:10', 'ESV', 'measurement-system-analysis', ['measurement', 'accuracy', 'integrity']),
  verse('proverbs-16-11-esv', 'A just balance and scales are the Lord\'s; all the weights in the bag are his work.', 'Proverbs 16:11', 'ESV', 'measurement-system-analysis', ['measurement', 'accuracy', 'truth']),
  verse('ephesians-4-25-niv', 'Therefore each of you must put off falsehood and speak truthfully to your neighbor, for we are all members of one body.', 'Ephesians 4:25', 'NIV', 'measurement-system-analysis', ['truth', 'integrity', 'honesty']),
  verse('luke-16-10-esv', 'One who is faithful in a very little is also faithful in much, and one who is dishonest in a very little is also dishonest in much.', 'Luke 16:10', 'ESV', 'measurement-system-analysis', ['integrity', 'accuracy', 'faithfulness']),

  verse('first-corinthians-4-2-esv', 'Moreover, it is required of stewards that they be found faithful.', '1 Corinthians 4:2', 'ESV', 'process-capability', ['stewardship', 'faithfulness', 'accountability']),
  verse('proverbs-13-4-esv', 'The soul of the sluggard craves and gets nothing, while the soul of the diligent is richly supplied.', 'Proverbs 13:4', 'ESV', 'process-capability', ['diligence', 'improvement', 'fruitfulness']),
  verse('john-15-8-esv', 'By this my Father is glorified, that you bear much fruit and so prove to be my disciples.', 'John 15:8', 'ESV', 'process-capability', ['fruitfulness', 'improvement', 'stewardship']),
  verse('proverbs-22-29-esv', 'Do you see a man skillful in his work? He will stand before kings; he will not stand before obscure men.', 'Proverbs 22:29', 'ESV', 'process-capability', ['skill', 'work', 'diligence']),

  verse('james-1-4-esv', 'And let steadfastness have its full effect, that you may be perfect and complete, lacking in nothing.', 'James 1:4', 'ESV', 'control-charts-spc', ['patience', 'discipline', 'consistency']),
  verse('proverbs-25-28-esv', 'A man without self-control is like a city broken into and left without walls.', 'Proverbs 25:28', 'ESV', 'control-charts-spc', ['control', 'discipline', 'watchfulness']),
  verse('proverbs-4-23-esv', 'Keep your heart with all vigilance, for from it flow the springs of life.', 'Proverbs 4:23', 'ESV', 'control-charts-spc', ['watchfulness', 'discipline', 'consistency']),
  verse('hebrews-12-11-esv', 'For the moment all discipline seems painful rather than pleasant, but later it yields the peaceful fruit of righteousness to those who have been trained by it.', 'Hebrews 12:11', 'ESV', 'control-charts-spc', ['discipline', 'training', 'patience']),

  verse('proverbs-14-15-esv-hypothesis', 'The simple believes everything, but the prudent gives thought to his steps.', 'Proverbs 14:15', 'ESV', 'hypothesis-testing', ['testing', 'discernment', 'careful judgment']),
  verse('hebrews-5-14-esv', 'But solid food is for the mature, for those who have their powers of discernment trained by constant practice to distinguish good from evil.', 'Hebrews 5:14', 'ESV', 'hypothesis-testing', ['discernment', 'practice', 'judgment']),
  verse('proverbs-18-17-esv', 'The one who states his case first seems right, until the other comes and examines him.', 'Proverbs 18:17', 'ESV', 'hypothesis-testing', ['testing', 'evidence', 'judgment']),
  verse('first-john-4-1-esv', 'Beloved, do not believe every spirit, but test the spirits to see whether they are from God,', '1 John 4:1', 'ESV', 'hypothesis-testing', ['testing', 'discernment', 'careful judgment']),

  verse('proverbs-20-5-esv', 'The purpose in a man\'s heart is like deep water, but a man of understanding will draw it out.', 'Proverbs 20:5', 'ESV', 'regression-correlation', ['understanding', 'insight', 'relationships']),
  verse('proverbs-4-7-niv', 'The beginning of wisdom is this: Get wisdom. Though it cost all you have, get understanding.', 'Proverbs 4:7', 'NIV', 'regression-correlation', ['wisdom', 'understanding', 'insight']),
  verse('daniel-2-21-niv', 'He gives wisdom to the wise and knowledge to the discerning.', 'Daniel 2:21', 'NIV', 'regression-correlation', ['wisdom', 'knowledge', 'discernment']),
  verse('ecclesiastes-7-25-esv', 'I turned my heart to know and to search out and to seek wisdom and the scheme of things,', 'Ecclesiastes 7:25', 'ESV', 'regression-correlation', ['searching', 'patterns', 'understanding']),

  verse('proverbs-15-22-esv', 'Without counsel plans fail, but with many advisers they succeed.', 'Proverbs 15:22', 'ESV', 'doe', ['planning', 'counsel', 'design']),
  verse('proverbs-16-3-esv', 'Commit your work to the Lord, and your plans will be established.', 'Proverbs 16:3', 'ESV', 'doe', ['planning', 'work', 'diligence']),
  verse('proverbs-24-27-esv', 'Prepare your work outside; get everything ready for yourself in the field, and after that build your house.', 'Proverbs 24:27', 'ESV', 'doe', ['preparation', 'planning', 'design']),
  verse('luke-14-28-esv-doe', 'For which of you, desiring to build a tower, does not first sit down and count the cost, whether he has enough to complete it?', 'Luke 14:28', 'ESV', 'doe', ['preparation', 'planning', 'counting the cost']),

  verse('proverbs-21-5-niv-power', 'The plans of the diligent lead to profit as surely as haste leads to poverty.', 'Proverbs 21:5', 'NIV', 'sample-size-power', ['preparation', 'prudence', 'planning']),
  verse('proverbs-24-3-esv', 'By wisdom a house is built, and by understanding it is established;', 'Proverbs 24:3', 'ESV', 'sample-size-power', ['preparation', 'wisdom', 'understanding']),
  verse('proverbs-27-23-esv', 'Know well the condition of your flocks, and give attention to your herds,', 'Proverbs 27:23', 'ESV', 'sample-size-power', ['preparation', 'counting', 'stewardship']),
  verse('proverbs-16-9-esv', 'The heart of man plans his way, but the Lord establishes his steps.', 'Proverbs 16:9', 'ESV', 'sample-size-power', ['planning', 'prudence', 'preparation']),

  verse('proverbs-18-13-esv', 'If one gives an answer before he hears, it is his folly and shame.', 'Proverbs 18:13', 'ESV', 'anova', ['discernment', 'comparison', 'careful judgment']),
  verse('proverbs-24-23-esv', 'These also are sayings of the wise. Partiality in judging is not good.', 'Proverbs 24:23', 'ESV', 'anova', ['comparison', 'judgment', 'discernment']),
  verse('first-corinthians-2-13-esv', 'And we impart this in words not taught by human wisdom but taught by the Spirit, interpreting spiritual truths to those who are spiritual.', '1 Corinthians 2:13', 'ESV', 'anova', ['discernment', 'interpretation', 'understanding']),
  verse('proverbs-2-11-esv', 'discretion will watch over you, understanding will guard you,', 'Proverbs 2:11', 'ESV', 'anova', ['understanding', 'discernment', 'careful judgment']),

  verse('proverbs-11-14-esv', 'Where there is no guidance, a people falls, but in an abundance of counselors there is safety.', 'Proverbs 11:14', 'ESV', 'logistic-regression', ['judgment', 'choices', 'guidance']),
  verse('deuteronomy-30-19-esv', 'I have set before you life and death, blessing and curse. Therefore choose life, that you and your offspring may live,', 'Deuteronomy 30:19', 'ESV', 'logistic-regression', ['choices', 'outcomes', 'judgment']),
  verse('proverbs-3-21-esv', 'My son, do not lose sight of these--keep sound wisdom and discretion,', 'Proverbs 3:21', 'ESV', 'logistic-regression', ['wisdom', 'discretion', 'judgment']),
  verse('proverbs-19-20-esv', 'Listen to advice and accept instruction, that you may gain wisdom in the future.', 'Proverbs 19:20', 'ESV', 'logistic-regression', ['wisdom', 'choices', 'outcomes']),

  verse('proverbs-15-2-esv', 'The tongue of the wise commends knowledge, but the mouths of fools pour out folly.', 'Proverbs 15:2', 'ESV', 'reporting-export', ['communication', 'clarity', 'wisdom']),
  verse('colossians-4-6-esv', 'Let your speech always be gracious, seasoned with salt, so that you may know how you ought to answer each person.', 'Colossians 4:6', 'ESV', 'reporting-export', ['communication', 'clarity', 'grace']),
  verse('ephesians-4-29-esv', 'Let no corrupting talk come out of your mouths, but only such as is good for building up, as fits the occasion,', 'Ephesians 4:29', 'ESV', 'reporting-export', ['communication', 'clarity', 'accountability']),
  verse('proverbs-16-23-esv', 'The heart of the wise makes his speech judicious and adds persuasiveness to his lips.', 'Proverbs 16:23', 'ESV', 'reporting-export', ['communication', 'wisdom', 'clarity'])
];

export function getVerseForCategory(category: VerseCategory): Verse {
  const categoryMatches = verses.filter(verse => verse.category === category);
  const candidates = categoryMatches.length
    ? categoryMatches
    : verses.filter(verse => verse.category === 'home-dashboard');

  return candidates[Math.floor(Math.random() * candidates.length)];
}
