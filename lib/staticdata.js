(() => {
  'use strict';

  function normName(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const ATS_MAP = [
    { match: ['greenhouse.io', 'job-boards.greenhouse', 'boards.greenhouse'], key: 'greenhouse', name: 'Greenhouse', friendliness: 'easy' },
    { match: ['jobs.lever.co', 'lever.co'], key: 'lever', name: 'Lever', friendliness: 'easy' },
    { match: ['ashbyhq.com', 'jobs.ashbyhq'], key: 'ashby', name: 'Ashby', friendliness: 'easy' },
    { match: ['myworkdayjobs.com', 'wd1.myworkday', 'wd3.myworkday', 'wd5.myworkday', '.workday.com'], key: 'workday', name: 'Workday', friendliness: 'painful' },
    { match: ['taleo.net', '.taleo.'], key: 'taleo', name: 'Taleo', friendliness: 'painful' },
    { match: ['icims.com'], key: 'icims', name: 'iCIMS', friendliness: 'painful' },
    { match: ['oraclecloud.com', 'fa.us', '.oraclecloud'], key: 'oracle', name: 'Oracle Cloud', friendliness: 'painful' },
    { match: ['successfactors.com', 'sapsf.com', 'jobs.sap.com'], key: 'successfactors', name: 'SuccessFactors', friendliness: 'painful' },
    { match: ['smartrecruiters.com', 'jobs.smartrecruiters'], key: 'smartrecruiters', name: 'SmartRecruiters', friendliness: 'medium' },
    { match: ['jobvite.com', 'jobs.jobvite'], key: 'jobvite', name: 'Jobvite', friendliness: 'medium' },
    { match: ['bamboohr.com'], key: 'bamboohr', name: 'BambooHR', friendliness: 'easy' },
    { match: ['breezy.hr'], key: 'breezy', name: 'Breezy', friendliness: 'easy' },
    { match: ['applytojob.com', 'jazz.co', 'jazzhr'], key: 'jazzhr', name: 'JazzHR', friendliness: 'medium' },
    { match: ['recruitee.com'], key: 'recruitee', name: 'Recruitee', friendliness: 'easy' },
    { match: ['workable.com', 'apply.workable'], key: 'workable', name: 'Workable', friendliness: 'medium' },
    { match: ['jibeapply.com', 'jibe'], key: 'jibe', name: 'Jibe', friendliness: 'medium' },
    { match: ['brassring.com', 'kenexa'], key: 'brassring', name: 'BrassRing', friendliness: 'painful' },
    { match: ['workforcenow.adp', 'adp.com'], key: 'adp', name: 'ADP', friendliness: 'painful' },
    { match: ['paycomonline.net', 'paycom.com'], key: 'paycom', name: 'Paycom', friendliness: 'medium' },
    { match: ['paylocity.com'], key: 'paylocity', name: 'Paylocity', friendliness: 'medium' },
    { match: ['ultipro.com', 'ukg.com', 'ukgpro'], key: 'ukg', name: 'UKG/UltiPro', friendliness: 'painful' },
    { match: ['dayforcehcm.com', 'dayforce'], key: 'dayforce', name: 'Dayforce', friendliness: 'painful' },
    { match: ['skyward.iscorp', 'iscorp.com'], key: 'skyward', name: 'Skyward', friendliness: 'medium' },
    { match: ['saashr.com'], key: 'saashr', name: 'SaaSHR', friendliness: 'medium' },
    { match: ['eightfold.ai'], key: 'eightfold', name: 'Eightfold', friendliness: 'medium' },
    { match: ['phenompeople.com', 'phenom'], key: 'phenom', name: 'Phenom', friendliness: 'medium' },
    { match: ['teamtailor.com'], key: 'teamtailor', name: 'Teamtailor', friendliness: 'easy' },
    { match: ['rippling.com', 'rippling-ats'], key: 'rippling', name: 'Rippling', friendliness: 'easy' },
    { match: ['gem.com', 'jobs.gem'], key: 'gem', name: 'Gem', friendliness: 'easy' },
    { match: ['jobscore.com'], key: 'jobscore', name: 'JobScore', friendliness: 'medium' },
    { match: ['wellfound.com', 'angel.co'], key: 'wellfound', name: 'Wellfound', friendliness: 'easy' },
    { match: ['myworkdaysite.com'], key: 'workday', name: 'Workday', friendliness: 'painful' }
  ];
  function atsInfo(url) {
    if (!url) return null;
    const u = String(url).toLowerCase();
    for (const e of ATS_MAP) if (e.match.some(m => u.includes(m))) return { key: e.key, name: e.name, friendliness: e.friendliness };
    return null;
  }

  const SOURCE_TO_ATS_KEY = {
    grnhse: 'greenhouse', lever: 'lever', eu_lever: 'lever', ashby: 'ashby',
    breezy: 'breezy', jazzhr: 'jazzhr', smartrec: 'smartrecruiters',
    workable: 'workable', workday: 'workday', icims: 'icims',
    successfactors: 'successfactors', taleo: 'taleo', recruitee: 'recruitee',
    bamboohr: 'bamboohr', jobvite: 'jobvite', dayforce: 'dayforce', teamtailor: 'teamtailor'
  };
  function atsBySource(code) {
    const key = SOURCE_TO_ATS_KEY[String(code || '').toLowerCase()];
    if (!key) return null;
    const e = ATS_MAP.find(x => x.key === key);
    return e ? { key: e.key, name: e.name, friendliness: e.friendliness } : null;
  }

  const PREFERRED_BOARD_BY_DOMAIN = {
    'join.com': { ats: 'join', token: 'join' },
    'google.com': { ats: 'google', token: 'google' },
    'icims.com': { ats: 'icims', token: 'icimstalentacquisition' },
    'greenhouse.com': { ats: 'grnhse', token: 'greenhouse' },
    'employinc.com': { ats: 'lever', token: 'employ' },
    'workday.com': { ats: 'workday', token: 'workday-wd5-workday' },
    'mcdonalds.com': { ats: 'successfactors', token: 'com_mcdonaldsc' },
    'hrblock.com': { ats: 'icims', token: 'hrblock' }
  };
  function effectiveCompanyData(job) {
    const co = job && job.enriched_company_data;
    if (!co) return null;
    const preferred = PREFERRED_BOARD_BY_DOMAIN[String(co.homepage_uri || '').toLowerCase()];
    if (!preferred) return co;
    const source = String(job.source || '').toLowerCase();
    const token = String(job.board_token || '').toLowerCase();
    return (source === preferred.ats && token === preferred.token) ? co : null;
  }

  const AGENCIES = [
    'robert half', 'insight global', 'teksystems', 'randstad', 'adecco', 'kelly services',
    'manpowergroup', 'manpower', 'aerotek', 'aston carter', 'cybercoders', 'jobot',
    'motion recruitment', 'beacon hill staffing group', 'beacon hill', 'kforce', 'apex systems',
    'collabera', 'the judge group', 'judge group', 'michael page', 'hays', 'robert walters',
    'experis', 'modis', 'akkodis', 'system one', 'signature consultants', 'mindlance', 'eteam',
    'us tech solutions', 'diverse lynx', 'cynet systems', 'compunnel', 'yoh', 'addison group',
    'vaco', 'lorien', 'harnham', 'randstad digital', 'nigel frank', 'mondo', 'onward search'
  ];
  const AGENCY_SET = new Set(AGENCIES.map(normName));
  const AGENCY_TOKENS = ['staffing', 'recruiting', 'recruiters', 'talent solutions', 'workforce solutions', 'consulting group', 'placement services'];
  function isAgency(name) {
    const n = normName(name);
    if (!n) return false;
    if (AGENCY_SET.has(n)) return true;
    return AGENCY_TOKENS.some(t => (' ' + n + ' ').includes(' ' + t + ' ') || n.endsWith(' ' + t) || n.includes(t));
  }

  const MLM = [
    'primerica', 'globe life', 'american income life', 'ail', 'amway', 'herbalife',
    'vector marketing', 'cutco', 'combined insurance', 'bankers life', 'symmetry financial group',
    'symmetry financial', 'family first life', 'world financial group', 'wfg', 'aflac',
    'transamerica agency network', 'ppl', 'legalshield', 'it works', 'monat', 'arbonne',
    'rodan and fields', 'younique', 'nu skin', 'mary kay', 'avon'
  ];
  const MLM_SET = new Set(MLM.map(normName));
  function isMLM(name) { return MLM_SET.has(normName(name)); }

  const AI_COMPANIES = [
    'openai', 'anthropic', 'deepmind', 'google deepmind', 'cohere', 'mistral', 'mistral ai',
    'hugging face', 'stability ai', 'midjourney', 'runway', 'runway ml', 'perplexity', 'perplexity ai',
    'character ai', 'inflection ai', 'scale ai', 'together ai', 'fireworks ai', 'replicate', 'modal labs',
    'cerebras', 'cerebras systems', 'groq', 'sambanova', 'sambanova systems', 'xai', 'glean', 'harvey',
    'harvey ai', 'moveworks', 'sierra', 'cognition', 'cognition labs', 'codeium', 'windsurf', 'tabnine',
    'poolside', 'magic', 'contextual ai', 'imbue', 'essential ai', 'reka', 'reka ai', 'liquid ai',
    'world labs', 'physical intelligence', 'skild ai', 'figure', 'figure ai', 'covariant', 'waabi', 'wayve',
    'c3 ai', 'c3.ai', 'datarobot', 'h2o.ai', 'dataiku', 'clarifai', 'landing ai', 'synthesia', 'elevenlabs',
    'eleven labs', 'descript', 'jasper', 'jasper ai', 'writer', 'typeface', 'hebbia', 'suno', 'udio',
    'luma ai', 'luma labs', 'pika', 'pika labs', 'ideogram', 'leonardo ai', 'recraft', 'krea', 'anyscale',
    'weights and biases', 'langchain', 'llamaindex', 'pinecone', 'weaviate', 'chroma', 'baseten', 'octoml',
    'lightning ai', 'deepgram', 'assemblyai', 'twelve labs', 'aleph alpha', 'sana ai', 'abridge',
    'glean ai', 'crusoe', 'lambda labs', 'nscale', 'together computer'
  ];
  const AI_SET = new Set(AI_COMPANIES.map(normName));
  function isAICompany(name) {
    const n = normName(name);
    if (!n) return false;
    if (AI_SET.has(n)) return true;
    return /(^| )ai( |$)/.test(n);
  }

  globalThis.HCX_DATA = {
    normName, ATS_MAP, atsInfo, atsBySource, effectiveCompanyData,
    AGENCIES, isAgency, MLM, isMLM, AI_COMPANIES, isAICompany
  };
})();
