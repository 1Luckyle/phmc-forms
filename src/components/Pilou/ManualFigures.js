// src/components/Pilou/ManualFigures.js
//
// Schémas du manuel médical de Pilou, dessinés en SVG (aucune image externe) : volontairement simples, pour être lus d'un coup d'œil pendant une scène.
// Un schéma = un identifiant cité dans clinical/manual.js (bloc `figure`). Un test vérifie que chaque identifiant cité existe ici.
import React from 'react';

const INK = '#e6edf3';
const MUTED = '#8b949e';
const LINE = '#3d444d';
const PANEL = '#161b22';
const BLUE = '#58a6ff';
const RED = '#f85149';
const GREEN = '#3fb950';
const AMBER = '#d29922';
const PURPLE = '#bc8cff';
const SKIN = '#e0ac8a';
const WHITE = '#ffffff';

const Svg = ({ w, h, label, children }) => (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg" fontFamily="inherit">{children}</svg>
);
const Txt = ({ x, y, children, size = 13, fill = INK, anchor = 'middle', weight = 400 }) => <text x={x} y={y} fontSize={size} fill={fill} textAnchor={anchor} fontWeight={weight}>{children}</text>;
// Texte sur plusieurs lignes, centré sur (x, y).
const Lines = ({ x, y, lines, size = 12, fill = INK, weight = 400, gap = 15 }) => (
    <text x={x} y={y - ((lines.length - 1) * gap) / 2} fontSize={size} fill={fill} textAnchor="middle" fontWeight={weight}>
        {lines.map((line, index) => <tspan key={line} x={x} dy={index === 0 ? 0 : gap}>{line}</tspan>)}
    </text>
);
const Arrow = ({ x1, y1, x2, y2, color = MUTED }) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 7;
    const a = [x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45)];
    const b = [x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45)];
    return <g stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"><line x1={x1} y1={y1} x2={x2} y2={y2} /><polyline points={`${a[0]},${a[1]} ${x2},${y2} ${b[0]},${b[1]}`} /></g>;
};

const PHASE_ITEMS = [[['Premier', 'regard'], BLUE], [['Gestes', 'immédiats'], RED], [['Examen', 'et bilan'], PURPLE], [['Traitement'], GREEN], [['Surveillance'], AMBER], [['Orientation', 'et suites'], MUTED]];
const Phases = () => (
    <Svg w={720} h={112} label="Les six temps d'une prise en charge">
        {PHASE_ITEMS.map(([lines, color], index) => {
            const x = 6 + index * 120;
            return (
                <g key={lines.join(' ')}>
                    <rect x={x} y={22} width={104} height={70} rx={10} fill={PANEL} stroke={color} strokeWidth="2" />
                    <circle cx={x + 52} cy={22} r={13} fill={color} />
                    <Txt x={x + 52} y={27} size={14} fill="#0d1117" weight={700}>{index + 1}</Txt>
                    <Lines x={x + 52} y={66} lines={lines} size={13} weight={600} />
                    {index < 5 && <Arrow x1={x + 106} y1={57} x2={x + 118} y2={57} />}
                </g>
            );
        })}
    </Svg>
);

const ABCDE_ITEMS = [['A', ['Voies', 'aériennes'], BLUE], ['B', ['Respiration'], GREEN], ['C', ['Circulation'], RED], ['D', ['Conscience'], PURPLE], ['E', ['Exposition'], AMBER]];
const Abcde = () => (
    <Svg w={720} h={140} label="Bilan A B C D E">
        {ABCDE_ITEMS.map(([letter, lines, color], index) => {
            const cx = 72 + index * 144;
            return (
                <g key={letter}>
                    <circle cx={cx} cy={50} r={34} fill={PANEL} stroke={color} strokeWidth="3" />
                    <Txt x={cx} y={62} size={34} fill={color} weight={700}>{letter}</Txt>
                    <Lines x={cx} y={112} lines={lines} size={13} weight={600} />
                    {index < 4 && <Arrow x1={cx + 42} y1={50} x2={cx + 100} y2={50} />}
                </g>
            );
        })}
    </Svg>
);

const Eye = ({ cx, cy, pupil }) => (
    <g>
        <ellipse cx={cx} cy={cy} rx={26} ry={16} fill="#f0f3f6" stroke={LINE} strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={13} fill="#6b8fb5" />
        <circle cx={cx} cy={cy} r={pupil} fill="#0d1117" />
    </g>
);
const PUPIL_ITEMS = [['Normales', 'égales, réactives', 6, 6, GREEN], ['Serrées', 'opioïdes', 2.4, 2.4, AMBER], ['Dilatées', 'stimulants, manque d\'oxygène', 11, 11, AMBER], ['Inégales', 'urgence après un choc à la tête', 6, 11, RED]];
const Pupils = () => (
    <Svg w={720} h={128} label="Aspects des pupilles">
        {PUPIL_ITEMS.map(([title, sub, left, right, color], index) => {
            const cx = 90 + index * 180;
            return (
                <g key={title}>
                    <Eye cx={cx - 32} cy={40} pupil={left} />
                    <Eye cx={cx + 32} cy={40} pupil={right} />
                    <Txt x={cx} y={88} size={14} fill={color} weight={700}>{title}</Txt>
                    <Txt x={cx} y={108} size={11.5} fill={MUTED}>{sub}</Txt>
                </g>
            );
        })}
    </Svg>
);

const PainScale = () => (
    <Svg w={720} h={130} label="Échelle de la douleur de 0 à 10">
        <defs><linearGradient id="pm-pain" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor={GREEN} /><stop offset="0.5" stopColor={AMBER} /><stop offset="1" stopColor={RED} /></linearGradient></defs>
        <rect x={30} y={34} width={660} height={22} rx={11} fill="url(#pm-pain)" />
        {Array.from({ length: 11 }, (_, n) => (
            <g key={n}><line x1={30 + n * 66} y1={56} x2={30 + n * 66} y2={64} stroke={MUTED} strokeWidth="1.5" /><Txt x={30 + n * 66} y={80} size={13} weight={600}>{n}</Txt></g>
        ))}
        <Txt x={30} y={22} size={12} fill={MUTED} anchor="start">Aucune douleur</Txt>
        <Txt x={690} y={22} size={12} fill={MUTED} anchor="end">Pire douleur imaginable</Txt>
        <Lines x={129} y={110} lines={['1 à 3 : légère', 'paracétamol']} size={12} fill={GREEN} weight={600} />
        <Lines x={360} y={110} lines={['4 à 6 : modérée', '+ anti-inflammatoire ou tramadol']} size={12} fill={AMBER} weight={600} />
        <Lines x={591} y={110} lines={['7 à 10 : intense', 'morphine ou fentanyl titrés']} size={12} fill={RED} weight={600} />
    </Svg>
);

const Tourniquet = () => (
    <Svg w={720} h={170} label="Pose d'un garrot">
        <path d="M40,60 Q30,90 40,120 L600,112 Q680,104 690,90 Q680,74 600,68 Z" fill={SKIN} fillOpacity="0.85" stroke="#b98363" strokeWidth="2" />
        <path d="M468,74 l10,10 l-12,8 l14,10 l-10,8" fill="none" stroke={RED} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x={352} y={56} width={30} height={70} rx={5} fill="#1f2937" stroke={INK} strokeWidth="2" />
        <rect x={360} y={44} width={14} height={18} rx={3} fill={AMBER} />
        <Arrow x1={130} y1={32} x2={60} y2={32} color={BLUE} />
        <Txt x={140} y={37} size={13} fill={BLUE} anchor="start" weight={600}>vers le cœur</Txt>
        <Txt x={367} y={30} size={13} weight={700}>Garrot</Txt>
        <Txt x={474} y={52} size={13} fill={RED} weight={700}>Plaie</Txt>
        <line x1={382} y1={140} x2={466} y2={140} stroke={MUTED} strokeWidth="1.5" /><line x1={382} y1={134} x2={382} y2={146} stroke={MUTED} strokeWidth="1.5" /><line x1={466} y1={134} x2={466} y2={146} stroke={MUTED} strokeWidth="1.5" />
        <Txt x={424} y={160} size={12.5} fill={INK} weight={600}>5 à 7 cm au-dessus</Txt>
        <Txt x={600} y={150} size={12} fill={MUTED}>Heure de pose écrite, bien visible</Txt>
        <Txt x={150} y={150} size={12} fill={MUTED}>Jamais sur une articulation</Txt>
    </Svg>
);

const Rcp = () => (
    <Svg w={720} h={230} label="Massage cardiaque : position des mains">
        <circle cx={170} cy={36} r={24} fill={PANEL} stroke={MUTED} strokeWidth="2" />
        <path d="M110,74 Q170,58 230,74 L244,210 L96,210 Z" fill={PANEL} stroke={MUTED} strokeWidth="2" />
        <line x1={170} y1={78} x2={170} y2={170} stroke={LINE} strokeWidth="6" strokeLinecap="round" />
        <line x1={128} y1={84} x2={212} y2={84} stroke={LINE} strokeWidth="3" strokeLinecap="round" />
        {[104, 124, 144].map((y) => <path key={y} d={`M122,${y} Q170,${y + 12} 218,${y}`} fill="none" stroke={LINE} strokeWidth="2" />)}
        <circle cx={170} cy={134} r={17} fill={RED} fillOpacity="0.9" />
        <Txt x={170} y={139} size={12} fill="#fff" weight={700}>ICI</Txt>
        <Arrow x1={300} y1={134} x2={194} y2={134} color={RED} />
        <Txt x={310} y={130} size={13.5} anchor="start" weight={700}>Talon de la main au centre du thorax,</Txt>
        <Txt x={310} y={148} size={13.5} anchor="start" weight={700}>sur la moitié basse du sternum</Txt>
        {[['100 à 120', 'compressions par minute', BLUE], ['5 à 6 cm', 'de profondeur, relâchement complet', GREEN], ['30 : 2', 'compressions pour insufflations (adulte)', AMBER]].map(([big, small, color], index) => (
            <g key={big}>
                <rect x={310} y={14 + index * 34} width={390} height={28} rx={6} fill={PANEL} stroke={color} strokeWidth="1.5" />
                <Txt x={322} y={33 + index * 34} size={14} fill={color} anchor="start" weight={700}>{big}</Txt>
                <Txt x={410} y={33 + index * 34} size={12.5} anchor="start">{small}</Txt>
            </g>
        ))}
        <Txt x={310} y={186} size={12.5} fill={MUTED} anchor="start">Bras tendus, épaules à la verticale des mains.</Txt>
        <Txt x={310} y={206} size={12.5} fill={MUTED} anchor="start">Relais du masseur toutes les 2 minutes.</Txt>
    </Svg>
);

const CHAIN_ITEMS = [['Alerter', 'appel à l\'aide, heure notée', BLUE], ['Masser', 'tout de suite, sans s\'arrêter', RED], ['Défibriller', 'dès que l\'appareil est là', AMBER], ['Soins spécialisés', 'adrénaline, réanimation', GREEN]];
const Chain = () => (
    <Svg w={720} h={96} label="Chaîne de survie">
        {CHAIN_ITEMS.map(([title, sub, color], index) => {
            const x = 8 + index * 178;
            return (
                <g key={title}>
                    <rect x={x} y={14} width={168} height={68} rx={34} fill={PANEL} stroke={color} strokeWidth="3" />
                    <Txt x={x + 84} y={44} size={14.5} fill={color} weight={700}>{title}</Txt>
                    <Txt x={x + 84} y={63} size={11.5} fill={MUTED}>{sub}</Txt>
                </g>
            );
        })}
    </Svg>
);

// [nom, angle affiché, x d'entrée dans la peau, angle en degrés, profondeur atteinte (y), couleur] — la peau commence à y = 70.
const NEEDLES = [['Intradermique', '10 à 15°', 80, 12, 80, PURPLE], ['Intraveineuse', '25°', 230, 25, 114, BLUE], ['Sous-cutanée', '45°', 390, 45, 128, AMBER], ['Intramusculaire', '90°', 560, 90, 172, RED]];
const Injection = () => (
    <Svg w={720} h={220} label="Angles d'injection selon la voie">
        <rect x={20} y={70} width={680} height={14} fill="#d9a183" /><rect x={20} y={84} width={680} height={20} fill="#c98c6c" />
        <rect x={20} y={104} width={680} height={40} fill="#e6c36a" fillOpacity="0.75" /><rect x={20} y={144} width={680} height={56} fill="#b0453f" fillOpacity="0.8" />
        <ellipse cx={300} cy={116} rx={40} ry={7} fill={BLUE} fillOpacity="0.9" />
        {[['Épiderme', 81], ['Derme', 98], ['Tissu sous la peau', 128], ['Muscle', 176]].map(([name, y]) => <Txt key={name} x={690} y={y} size={11.5} fill="#0d1117" anchor="end" weight={600}>{name}</Txt>)}
        <Txt x={300} y={120} size={10.5} fill="#0d1117" weight={700}>veine</Txt>
        {NEEDLES.map(([name, angle, x, degrees, depth, color]) => {
            const rad = (degrees * Math.PI) / 180;
            const length = (depth - 70) / Math.sin(rad) + 24;
            const tipX = degrees === 90 ? x : x + (depth - 70) / Math.tan(rad);
            const startX = tipX - length * Math.cos(rad);
            const startY = depth - length * Math.sin(rad);
            return (
                <g key={name}>
                    <line x1={startX} y1={startY} x2={tipX} y2={depth} stroke={color} strokeWidth="4" strokeLinecap="round" />
                    <circle cx={startX} cy={startY} r={5} fill={color} />
                    <Txt x={x} y={16} size={13} fill={color} weight={700}>{name}</Txt>
                    <Txt x={x} y={31} size={12} fill={MUTED}>{angle}</Txt>
                </g>
            );
        })}
    </Svg>
);

const RuleOfNines = () => (
    <Svg w={720} h={300} label="Règle des neuf pour la surface brûlée">
        <g fill={PANEL} stroke={MUTED} strokeWidth="2">
            <circle cx={210} cy={34} r={24} />
            <rect x={170} y={62} width={80} height={104} rx={12} />
            <rect x={132} y={66} width={30} height={104} rx={13} /><rect x={258} y={66} width={30} height={104} rx={13} />
            <rect x={172} y={172} width={36} height={118} rx={14} /><rect x={212} y={172} width={36} height={118} rx={14} />
        </g>
        <Txt x={210} y={39} size={13} fill={AMBER} weight={700}>9</Txt>
        <Lines x={210} y={112} lines={['18 devant', '18 derrière']} size={12} fill={AMBER} weight={700} />
        <Txt x={147} y={122} size={13} fill={AMBER} weight={700}>9</Txt><Txt x={273} y={122} size={13} fill={AMBER} weight={700}>9</Txt>
        <Txt x={190} y={236} size={13} fill={AMBER} weight={700}>18</Txt><Txt x={230} y={236} size={13} fill={AMBER} weight={700}>18</Txt>
        <Txt x={210} y={184} size={10.5} fill={RED} weight={700}>1</Txt>
        {[['Tête et cou', '9 %'], ['Chaque bras', '9 %'], ['Devant du tronc', '18 %'], ['Dos', '18 %'], ['Chaque jambe', '18 %'], ['Organes génitaux', '1 %']].map(([zone, value], index) => (
            <g key={zone}>
                <rect x={360} y={22 + index * 36} width={330} height={28} rx={6} fill={PANEL} stroke={LINE} />
                <Txt x={374} y={41 + index * 36} size={13} anchor="start">{zone}</Txt>
                <Txt x={676} y={41 + index * 36} size={14} fill={AMBER} anchor="end" weight={700}>{value}</Txt>
            </g>
        ))}
        <Txt x={525} y={258} size={12.5} fill={MUTED}>La paume de la main du patient = 1 %.</Txt>
        <Txt x={525} y={278} size={12.5} fill={MUTED}>Chez l'enfant, la tête compte plus, les jambes moins.</Txt>
    </Svg>
);

const BURN_ITEMS = [['1er degré', 'rougeur', 96, GREEN], ['2e degré', 'cloques', 130, AMBER], ['3e degré', 'peau cartonnée', 190, RED]];
const BurnDepth = () => (
    <Svg w={720} h={230} label="Profondeur des brûlures">
        <rect x={20} y={70} width={470} height={30} fill="#d9a183" /><rect x={20} y={100} width={470} height={52} fill="#c98c6c" /><rect x={20} y={152} width={470} height={58} fill="#e6c36a" fillOpacity="0.75" />
        {[['Épiderme', 90], ['Derme (nerfs, vaisseaux)', 130], ['Tissu sous la peau', 186]].map(([name, y]) => <Txt key={name} x={32} y={y} size={12} fill="#0d1117" anchor="start" weight={600}>{name}</Txt>)}
        {BURN_ITEMS.map(([title, sub, depth, color], index) => {
            const x = 250 + index * 80;
            return (
                <g key={title}>
                    <rect x={x - 22} y={70} width={44} height={depth - 70} fill={color} fillOpacity="0.55" stroke={color} strokeWidth="2" />
                    <Txt x={x} y={40} size={13} fill={color} weight={700}>{title}</Txt>
                    <Txt x={x} y={57} size={11} fill={MUTED}>{sub}</Txt>
                </g>
            );
        })}
        {[['1er degré', 'douloureux, guérit seul', GREEN], ['2e degré', 'très douloureux, cloques', AMBER], ['3e degré', 'indolore : nerfs détruits, greffe', RED]].map(([title, sub, color], index) => (
            <g key={title}>
                <circle cx={520} cy={88 + index * 46} r={7} fill={color} />
                <Txt x={536} y={86 + index * 46} size={13} fill={color} anchor="start" weight={700}>{title}</Txt>
                <Txt x={536} y={103 + index * 46} size={11.5} fill={MUTED} anchor="start">{sub}</Txt>
            </g>
        ))}
    </Svg>
);

const Thorax = () => (
    <Svg w={720} h={282} label="Repères du thorax : exsufflation et drainage">
        <path d="M110,40 Q200,18 290,40 L312,230 Q200,256 88,230 Z" fill={PANEL} stroke={MUTED} strokeWidth="2" />
        <line x1={200} y1={38} x2={200} y2={190} stroke={LINE} strokeWidth="8" strokeLinecap="round" />
        <path d="M200,44 Q160,34 118,48" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" /><path d="M200,44 Q240,34 282,48" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        {[66, 92, 118, 144, 170, 196].map((y, index) => (
            <g key={y} fill="none" stroke={LINE} strokeWidth="2.5">
                <path d={`M196,${y} Q150,${y + 6} ${104 - index * 2},${y + 22}`} /><path d={`M204,${y} Q250,${y + 6} ${296 + index * 2},${y + 22}`} />
            </g>
        ))}
        <line x1={150} y1={50} x2={150} y2={226} stroke={BLUE} strokeWidth="1.5" strokeDasharray="5 5" />
        <circle cx={150} cy={84} r={9} fill={RED} /><Txt x={150} y={88.5} size={11} fill="#fff" weight={700}>A</Txt>
        <circle cx={98} cy={166} r={9} fill={GREEN} /><Txt x={98} y={170.5} size={11} fill="#0d1117" weight={700}>B</Txt>
        <Txt x={200} y={272} size={11.5} fill={BLUE}>pointillés : ligne médio-claviculaire</Txt>
        <g>
            <rect x={350} y={40} width={350} height={74} rx={8} fill={PANEL} stroke={RED} strokeWidth="1.5" />
            <Txt x={364} y={62} size={13.5} fill={RED} anchor="start" weight={700}>A — Exsufflation à l'aiguille</Txt>
            <Txt x={364} y={82} size={12} anchor="start">2e espace entre les côtes, sur la ligne qui</Txt>
            <Txt x={364} y={99} size={12} anchor="start">descend du milieu de la clavicule.</Txt>
            <rect x={350} y={128} width={350} height={74} rx={8} fill={PANEL} stroke={GREEN} strokeWidth="1.5" />
            <Txt x={364} y={150} size={13.5} fill={GREEN} anchor="start" weight={700}>B — Drain thoracique</Txt>
            <Txt x={364} y={170} size={12} anchor="start">5e espace entre les côtes, sur le côté,</Txt>
            <Txt x={364} y={187} size={12} anchor="start">en avant du milieu de l'aisselle.</Txt>
            <Txt x={350} y={226} size={12} fill={MUTED} anchor="start">Toujours au bord supérieur de la côte du dessous :</Txt>
            <Txt x={350} y={243} size={12} fill={MUTED} anchor="start">les vaisseaux passent sous chaque côte.</Txt>
        </g>
    </Svg>
);

// Un battement normal, tracé à partir de (x, y) sur une largeur w.
// st : décalage du segment ST (vers le haut) ; k : hauteur relative du tracé (les vignettes sont moitié moins hautes).
const beat = (x, y, w, st = 0, k = 1) => `M${x},${y} h${w * 0.12} q${w * 0.05},${-9 * k} ${w * 0.1},0 h${w * 0.06} l${w * 0.03},${5 * k} l${w * 0.04},${-42 * k} l${w * 0.04},${50 * k} l${w * 0.03},${-13 * k - st} h${w * 0.1} q${w * 0.09},${-15 * k} ${w * 0.18},${st} h${w * 0.2}`;
const VF = [0, -9, 6, -14, 10, -6, 13, -11, 4, -15, 9, -5, 12, -10, 7, -13, 5, -8, 11, -6, 0];
const MINI = [
    ['Rythme normal', '60 à 100 par minute', GREEN, (x, y) => `${beat(x, y, 111, 0, 0.5)} ${beat(x + 100, y, 111, 0, 0.5)}`],
    ['Tachycardie', 'plus de 100 par minute', AMBER, (x, y) => [0, 1, 2, 3].map((n) => beat(x + n * 50, y, 55.5, 0, 0.5)).join(' ')],
    ['Fibrillation ventriculaire', 'arrêt : massage et choc', RED, (x, y) => `M${x},${y} ${VF.map((dy, index) => `L${x + index * 10},${y + dy * 0.7}`).join(' ')}`],
    ['Asystolie (tracé plat)', 'arrêt : massage, adrénaline', RED, (x, y) => `M${x},${y} h200`],
    ['Sus-décalage ST', 'infarctus en cours', AMBER, (x, y) => `${beat(x, y, 111, 7, 0.5)} ${beat(x + 100, y, 111, 7, 0.5)}`],
];
const Ecg = () => (
    <Svg w={720} h={362} label="Électrocardiogramme : battement normal et tracés à reconnaître">
        <rect x={10} y={10} width={330} height={150} rx={8} fill={PANEL} stroke={LINE} />
        <path d={beat(30, 110, 290)} fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinejoin="round" />
        <Txt x={80} y={92} size={14} fill={BLUE} weight={700}>P</Txt><Txt x={131} y={50} size={14} fill={RED} weight={700}>QRS</Txt><Txt x={207} y={86} size={14} fill={PURPLE} weight={700}>T</Txt>
        <Txt x={175} y={148} size={12} fill={MUTED}>Un battement normal</Txt>
        <g>
            <Txt x={364} y={42} size={12.5} fill={BLUE} anchor="start" weight={700}>P</Txt><Txt x={384} y={42} size={12.5} anchor="start">les oreillettes se contractent</Txt>
            <Txt x={364} y={72} size={12.5} fill={RED} anchor="start" weight={700}>QRS</Txt><Txt x={402} y={72} size={12.5} anchor="start">les ventricules se contractent : le pouls</Txt>
            <Txt x={364} y={102} size={12.5} fill={PURPLE} anchor="start" weight={700}>T</Txt><Txt x={384} y={102} size={12.5} anchor="start">le cœur se recharge</Txt>
            <Txt x={364} y={136} size={12} fill={MUTED} anchor="start">Entre le QRS et le T : le segment ST.</Txt>
        </g>
        {MINI.map(([title, sub, color, path], index) => {
            const col = index % 3;
            const rowY = index < 3 ? 176 : 268;
            const x = 10 + col * 238;
            return (
                <g key={title}>
                    <rect x={x} y={rowY} width={226} height={84} rx={8} fill={PANEL} stroke={LINE} />
                    <path d={path(x + 13, rowY + 48)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                    <Txt x={x + 10} y={rowY + 16} size={11.5} fill={color} anchor="start" weight={700}>{title}</Txt>
                    <Txt x={x + 113} y={rowY + 76} size={10.5} fill={MUTED}>{sub}</Txt>
                </g>
            );
        })}
    </Svg>
);

const Node = ({ x, y, w, h = 44, lines, color = MUTED }) => (
    <g><rect x={x} y={y} width={w} height={h} rx={8} fill={PANEL} stroke={color} strokeWidth="2" /><Lines x={x + w / 2} y={y + h / 2 + 4} lines={lines} size={12.5} weight={600} /></g>
);
const Acr = () => (
    <Svg w={720} h={312} label="Boucle de réanimation de l'arrêt cardiaque">
        <Node x={180} y={8} w={360} lines={['Inconscient, ne respire pas : arrêt cardiaque']} color={RED} />
        <Arrow x1={360} y1={52} x2={360} y2={70} />
        <Node x={180} y={72} w={360} lines={['Massage 30 : 2, oxygène, défibrillateur posé']} color={BLUE} />
        <Arrow x1={360} y1={116} x2={360} y2={134} />
        <Node x={250} y={136} w={220} lines={['Analyse du rythme']} color={PURPLE} />
        <Arrow x1={310} y1={180} x2={200} y2={204} /><Arrow x1={410} y1={180} x2={520} y2={204} />
        <Node x={30} y={206} w={270} h={54} lines={['Choquable (fibrillation) :', '1 choc, puis massage 2 minutes']} color={AMBER} />
        <Node x={420} y={206} w={270} h={54} lines={['Non choquable (tracé plat) :', 'massage 2 minutes, adrénaline']} color={GREEN} />
        <path d="M30,233 H14 V158 H240" fill="none" stroke={MUTED} strokeWidth="2" strokeDasharray="5 4" /><Arrow x1={236} y1={158} x2={248} y2={158} />
        <path d="M690,233 H706 V158 H480" fill="none" stroke={MUTED} strokeWidth="2" strokeDasharray="5 4" /><Arrow x1={484} y1={158} x2={472} y2={158} />
        <Txt x={360} y={286} size={12} fill={MUTED}>Adrénaline toutes les 3 à 5 minutes · amiodarone après le 3e choc · chercher une cause réversible.</Txt>
        <Txt x={360} y={304} size={12} fill={MUTED}>On ne s'arrête que si le pouls revient ou sur décision médicale.</Txt>
    </Svg>
);

const Fast = () => (
    <Svg w={720} h={170} label="Test FAST de l'accident vasculaire cérébral">
        {[['F', 'Visage', 'un côté de la bouche tombe', BLUE], ['A', 'Bras', 'un bras retombe', GREEN], ['S', 'Parole', 'mots déformés ou absents', PURPLE], ['T', 'Temps', 'noter l\'heure, alerter', RED]].map(([letter, title, sub, color], index) => {
            const x = 8 + index * 178;
            const cx = x + 84;
            return (
                <g key={letter}>
                    <rect x={x} y={8} width={168} height={154} rx={10} fill={PANEL} stroke={color} strokeWidth="2" />
                    <Txt x={x + 22} y={36} size={22} fill={color} weight={700}>{letter}</Txt>
                    {index === 0 && <g><circle cx={cx} cy={62} r={26} fill="none" stroke={INK} strokeWidth="2" /><circle cx={cx - 9} cy={55} r={2.5} fill={INK} /><circle cx={cx + 9} cy={56} r={2.5} fill={INK} /><path d={`M${cx - 12},70 Q${cx},76 ${cx + 13},80`} fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" /></g>}
                    {index === 1 && <g stroke={INK} strokeWidth="3" strokeLinecap="round"><circle cx={cx} cy={44} r={8} fill="none" strokeWidth="2" /><line x1={cx} y1={52} x2={cx} y2={86} /><line x1={cx} y1={60} x2={cx - 30} y2={56} /><line x1={cx} y1={60} x2={cx + 26} y2={80} stroke={color} /></g>}
                    {index === 2 && <g><path d={`M${cx - 30},40 h60 a8,8 0 0 1 8,8 v26 a8,8 0 0 1 -8,8 h-34 l-14,12 v-12 h-12 a8,8 0 0 1 -8,-8 v-26 a8,8 0 0 1 8,-8 z`} fill="none" stroke={INK} strokeWidth="2" /><Txt x={cx} y={70} size={22} fill={color} weight={700}>?!</Txt></g>}
                    {index === 3 && <g stroke={INK} strokeWidth="2.5" strokeLinecap="round"><circle cx={cx} cy={62} r={26} fill="none" /><line x1={cx} y1={62} x2={cx} y2={44} /><line x1={cx} y1={62} x2={cx + 13} y2={68} stroke={color} /></g>}
                    <Txt x={cx} y={122} size={14.5} fill={color} weight={700}>{title}</Txt>
                    <Txt x={cx} y={143} size={11.5} fill={MUTED}>{sub}</Txt>
                </g>
            );
        })}
    </Svg>
);

const Ladder = () => (
    <Svg w={720} h={212} label="Les trois paliers d'antalgiques">
        {[['Palier 1', 'Douleur légère', 'paracétamol, anti-inflammatoires', GREEN, 120], ['Palier 2', 'Douleur modérée', 'tramadol', AMBER, 70], ['Palier 3', 'Douleur intense', 'morphine, fentanyl', RED, 20]].map(([title, pain, drugs, color, y], index) => {
            const x = 20 + index * 230;
            return (
                <g key={title}>
                    <rect x={x} y={y} width={220} height={204 - y} fill={PANEL} stroke={color} strokeWidth="2" />
                    <Txt x={x + 110} y={y + 28} size={16} fill={color} weight={700}>{title}</Txt>
                    <Txt x={x + 110} y={y + 49} size={12.5} weight={600}>{pain}</Txt>
                    <Txt x={x + 110} y={y + 68} size={11.5} fill={MUTED}>{drugs}</Txt>
                </g>
            );
        })}
    </Svg>
);

// ───────────── Cathéters veineux périphériques (canules IV) ─────────────
// [calibre, couleur, nom de la couleur, diamètre extérieur en mm, débit maximal (eau, théorique) en mL/min, usage sur deux lignes]
const CANNULAS = [
    ['26 G', '#a35be0', 'violet', 0.6, 19, ['Néonat,', 'bébés']],
    ['24 G', '#f4d03f', 'jaune', 0.7, 22, ['Enfants,', 'veines fragiles']],
    ['22 G', '#2f7fe0', 'bleu', 0.9, 35, ['Petites veines,', 'perf simple']],
    ['20 G', '#f06fb0', 'rose', 1.1, 60, ['Le quotidien :', 'perf, antibio']],
    ['18 G', '#2ea86b', 'vert', 1.3, 105, ['Remplissage,', 'transfusion']],
    ['16 G', '#9aa1a9', 'gris', 1.7, 210, ['Remplissage', 'rapide']],
    ['14 G', '#f39c2b', 'orange', 2.1, 345, ['Urgence vitale,', 'choc hémorragique']],
];
const Cannulas = () => (
    <Svg w={720} h={318} label="Cathéters veineux par calibre : couleur, diamètre, débit et usage">
        {CANNULAS.map(([gauge, color, colorName, mm, flow, usage], index) => {
            const cx = 60 + index * 100;
            const needle = 1.2 + mm * 1.4;
            return (
                <g key={gauge}>
                    <line x1={cx} y1={14} x2={cx} y2={74} stroke="#c9d1d9" strokeWidth={needle} strokeLinecap="round" />
                    <rect x={cx - needle / 2 - 1.5} y={36} width={needle + 3} height={38} rx={needle / 2} fill={color} opacity="0.55" />
                    <path d={`M${cx - 6},72 L${cx + 6},72 L${cx + 10},98 L${cx - 10},98 Z`} fill={color} />
                    <ellipse cx={cx - 16} cy={90} rx={9} ry={5.5} transform={`rotate(-12 ${cx - 16} 90)`} fill={color} opacity="0.85" />
                    <ellipse cx={cx + 16} cy={90} rx={9} ry={5.5} transform={`rotate(12 ${cx + 16} 90)`} fill={color} opacity="0.85" />
                    <rect x={cx - 8} y={98} width={16} height={28} rx={3} fill="#e6edf3" opacity="0.22" stroke="#8b949e" strokeWidth="1.5" />
                    <rect x={cx - 3} y={104} width={6} height={16} rx={2} fill={color} opacity="0.6" />
                    <rect x={cx - 6} y={126} width={12} height={12} rx={2} fill="none" stroke="#8b949e" strokeWidth="1.5" />
                    <Txt x={cx} y={164} size={18} fill={color} weight={700}>{gauge}</Txt>
                    <Txt x={cx} y={180} size={11.5} fill={INK} weight={600}>{colorName}</Txt>
                    <Txt x={cx} y={194} size={11} fill={MUTED}>{`Ø ${String(mm).replace('.', ',')} mm`}</Txt>
                    <rect x={cx - 40} y={204} width={80} height={8} rx={4} fill={LINE} />
                    <rect x={cx - 40} y={204} width={Math.max(5, (80 * flow) / 345)} height={8} rx={4} fill={color} />
                    <Txt x={cx} y={230} size={13} fill={INK} weight={700}>{`${flow} mL/min`}</Txt>
                    <Lines x={cx} y={262} lines={usage} size={10.5} fill={INK} gap={13} />
                </g>
            );
        })}
        <Txt x={360} y={304} size={12.5} fill={AMBER} weight={600}>Plus le chiffre (G, « gauge ») est petit, plus le cathéter est gros et plus il débite.</Txt>
    </Svg>
);

// ───────────── Électrodes ─────────────
// Silhouette de face ou de dos, centrée sur x = 150 (tête, épaules, bras, tronc, jambes). Le tronc va de y = 62 à 232.
const Body = ({ back = false, legs = false }) => (
    <g fill={PANEL} stroke={MUTED} strokeWidth="2">
        <circle cx={150} cy={38} r={20} />
        <rect x={62} y={70} width={22} height={124} rx={11} /><rect x={216} y={70} width={22} height={124} rx={11} />
        <rect x={85} y={62} width={130} height={170} rx={26} />
        {legs && <><rect x={100} y={228} width={46} height={66} rx={18} /><rect x={154} y={228} width={46} height={66} rx={18} /></>}
        <g fill="none" stroke={LINE} strokeWidth="2">
            {back ? <><path d="M150,76 L150,222" /><path d="M118,96 Q132,112 134,134" /><path d="M182,96 Q168,112 166,134" /></> : <><path d="M150,80 L150,170" /><path d="M118,78 Q150,68 182,78" /></>}
        </g>
    </g>
);
const Pad = ({ x, y, w = 36, h = 48, rotate = 0, n }) => (
    <g transform={`rotate(${rotate} ${x} ${y})`}>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={8} fill={RED} fillOpacity="0.9" stroke={WHITE} strokeWidth="2" />
        <circle cx={x} cy={y} r={11} fill={WHITE} /><Txt x={x} y={y + 5} size={14} fill="#0d1117" weight={700}>{n}</Txt>
    </g>
);

const DefibPads = () => (
    <Svg w={720} h={344} label="Placement des électrodes du défibrillateur chez l'adulte et variante antéro-postérieure">
        <g transform="translate(20 6)">
            <Body />
            <Pad x={124} y={102} rotate={-18} n="1" />
            <Pad x={198} y={170} w={32} h={52} rotate={4} n="2" />
            <path d="M138,126 Q170,160 188,152" fill="none" stroke={AMBER} strokeWidth="2.5" strokeDasharray="5 4" /><Arrow x1={178} y1={150} x2={188} y2={152} color={AMBER} />
        </g>
        <Txt x={170} y={262} size={14.5} fill={BLUE} weight={700}>Adulte : position antéro-latérale</Txt>
        <Lines x={170} y={298} lines={['1  sous la clavicule droite, à droite du sternum', '2  sur le côté gauche, sous l\'aisselle, au niveau du mamelon']} size={11.5} fill={INK} gap={17} />
        <line x1={360} y1={20} x2={360} y2={330} stroke={LINE} strokeDasharray="4 5" />
        <g transform="translate(468 38) scale(0.78) translate(-150 0)">
            <Body />
            <Pad x={168} y={116} w={38} h={50} n="1" />
        </g>
        <g transform="translate(618 38) scale(0.78) translate(-150 0)">
            <Body back />
            <Pad x={150} y={120} w={38} h={50} n="2" />
        </g>
        <Txt x={468} y={216} size={11.5} fill={MUTED}>de face</Txt><Txt x={618} y={216} size={11.5} fill={MUTED}>de dos</Txt>
        <Txt x={540} y={246} size={14.5} fill={BLUE} weight={700}>Enfant, ou si le côté est impossible</Txt>
        <Lines x={540} y={290} lines={['1  au centre du thorax, sur le cœur', '2  au milieu du dos, entre les omoplates', 'Électrodes pédiatriques avant 8 ans si disponibles']} size={11.5} fill={INK} gap={17} />
    </Svg>
);

const ECG_LEADS = [
    ['V1', '#e5484d', 140, 118], ['V2', '#f4d03f', 160, 118], ['V3', '#2ea86b', 173, 127], ['V4', '#8b5e3c', 187, 135], ['V5', '#3a3f47', 202, 135], ['V6', '#a35be0', 213, 135],
];
const EcgLeads = () => (
    <Svg w={720} h={372} label="Placement des électrodes de l'électrocardiogramme : dérivations V1 à V6 et membres">
        <g transform="translate(0 4) scale(1.2)">
            <Body legs />
            {/* membres : code de couleur européen */}
            {[['RA', '#e5484d', 73, 176], ['LA', '#f4d03f', 227, 176], ['RL', '#3a3f47', 123, 270], ['LL', '#2ea86b', 177, 270]].map(([name, color, x, y]) => (
                <g key={name}><circle cx={x} cy={y} r={10} fill={color} stroke={WHITE} strokeWidth="2" /><Txt x={x} y={y + 4} size={9.5} fill={color === '#f4d03f' ? '#0d1117' : WHITE} weight={700}>{name}</Txt></g>
            ))}
            <line x1={150} y1={134} x2={216} y2={134} stroke={BLUE} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            {ECG_LEADS.map(([name, color, x, y]) => (
                <g key={name}><circle cx={x} cy={y} r={5.6} fill={color} stroke={WHITE} strokeWidth="1.4" /><Txt x={x} y={y - 8.5} size={8} fill={INK} weight={700}>{name.slice(1)}</Txt></g>
            ))}
        </g>
        <Txt x={180} y={366} size={11} fill={MUTED}>Patient de face : sa droite est à gauche du dessin</Txt>
        <g>
            <Txt x={330} y={28} size={14.5} fill={BLUE} anchor="start" weight={700}>Les 6 électrodes sur le thorax (précordiales)</Txt>
            {[['V1', '#e5484d', '4e espace entre les côtes, bord DROIT du sternum'], ['V2', '#f4d03f', '4e espace, bord GAUCHE du sternum'], ['V3', '#2ea86b', 'entre V2 et V4'],
                ['V4', '#8b5e3c', '5e espace, sous le milieu de la clavicule gauche'], ['V5', '#3a3f47', 'même hauteur que V4, devant l\'aisselle'], ['V6', '#a35be0', 'même hauteur, au milieu de l\'aisselle']].map(([name, color, text], index) => (
                <g key={name}>
                    <circle cx={342} cy={56 + index * 28} r={8} fill={color} stroke={WHITE} strokeWidth="1.6" />
                    <Txt x={358} y={61 + index * 28} size={12.5} fill={INK} anchor="start"><tspan fontWeight="700">{name}</tspan>{`  ${text}`}</Txt>
                </g>
            ))}
            <Txt x={330} y={250} size={14.5} fill={BLUE} anchor="start" weight={700}>Les 4 électrodes des membres</Txt>
            {[['RA', '#e5484d', 'rouge : bras droit'], ['LA', '#f4d03f', 'jaune : bras gauche'], ['LL', '#2ea86b', 'vert : jambe gauche'], ['RL', '#3a3f47', 'noir : jambe droite']].map(([name, color, text], index) => (
                <g key={name}>
                    <circle cx={342 + (index % 2) * 190} cy={276 + Math.floor(index / 2) * 28} r={8} fill={color} stroke={WHITE} strokeWidth="1.6" />
                    <Txt x={358 + (index % 2) * 190} y={281 + Math.floor(index / 2) * 28} size={12.5} fill={INK} anchor="start">{text}</Txt>
                </g>
            ))}
            <Txt x={330} y={346} size={11.5} fill={MUTED} anchor="start">Peau propre et sèche, poils rasés si besoin.</Txt>
        </g>
    </Svg>
);

export const FIGURES = {
    phases: Phases, abcde: Abcde, pupils: Pupils, 'pain-scale': PainScale, tourniquet: Tourniquet, rcp: Rcp, chain: Chain, injection: Injection,
    'rule-of-nines': RuleOfNines, 'burn-depth': BurnDepth, thorax: Thorax, ecg: Ecg, acr: Acr, fast: Fast, ladder: Ladder,
    cannulas: Cannulas, 'defib-pads': DefibPads, 'ecg-leads': EcgLeads,
};

const ManualFigure = ({ id, caption }) => {
    const Figure = FIGURES[id];
    if (!Figure) return null;
    return <figure className="pm-figure" data-figure={id}><Figure />{caption && <figcaption>{caption}</figcaption>}</figure>;
};

export default ManualFigure;
