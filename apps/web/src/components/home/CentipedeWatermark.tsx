'use client';

import { motion } from 'framer-motion';

export function CentipedeWatermark() {
  return (
    <motion.svg
      width="120"
      height="240"
      viewBox="0 0 400 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="opacity-20 hover:opacity-50 transition-all duration-700"
      initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
      whileInView={{ opacity: 0.2, scale: 1, rotate: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      whileHover={{
        opacity: 0.5,
        scale: 1.08,
        rotate: 3,
        filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))',
      }}
    >
      <defs>
        {/* Gradientes para profundidad */}
        <radialGradient id="bodyGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
        </radialGradient>

        <radialGradient id="flowerGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff3366" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#cc0033" stopOpacity="0.5" />
        </radialGradient>

        {/* Filtro de sombra */}
        <filter id="shadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="1" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.5" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Patrón de textura */}
        <pattern id="texture" patternUnits="userSpaceOnUse" width="3" height="3">
          <path d="M 0,3 L 3,0" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />
        </pattern>
      </defs>

      <g className="text-accent" filter="url(#shadow)">
        {/* CABEZA DE ONI */}
        <g id="head">
          {/* Cráneo base */}
          <path
            d="M 200 60 Q 180 50 170 70 Q 165 85 170 100 Q 180 110 200 110 Q 220 110 230 100 Q 235 85 230 70 Q 220 50 200 60 Z"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2"
          />

          {/* Cuerno izquierdo */}
          <path
            d="M 175 65 Q 170 55 165 40 Q 163 30 160 20 Q 158 15 155 10 L 158 12 Q 162 20 164 28 Q 167 40 170 50 Q 172 58 175 65"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M 160 20 Q 155 18 150 25 L 155 22 Q 158 19 160 20" fill="currentColor" />

          {/* Cuerno derecho */}
          <path
            d="M 225 65 Q 230 55 235 40 Q 237 30 240 20 Q 242 15 245 10 L 242 12 Q 238 20 236 28 Q 233 40 230 50 Q 228 58 225 65"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M 240 20 Q 245 18 250 25 L 245 22 Q 242 19 240 20" fill="currentColor" />

          {/* Ojos */}
          <ellipse cx="185" cy="85" rx="8" ry="12" fill="currentColor" />
          <ellipse cx="185" cy="83" rx="4" ry="6" fill="black" />
          <ellipse cx="185" cy="81" rx="2" ry="3" fill="white" opacity="0.9">
            <animate
              attributeName="opacity"
              values="0.9;0.3;0.9"
              dur="6s"
              repeatCount="indefinite"
            />
          </ellipse>

          <ellipse cx="215" cy="85" rx="8" ry="12" fill="currentColor" />
          <ellipse cx="215" cy="83" rx="4" ry="6" fill="black" />
          <ellipse cx="215" cy="81" rx="2" ry="3" fill="white" opacity="0.9">
            <animate
              attributeName="opacity"
              values="0.9;0.3;0.9"
              dur="6s"
              repeatCount="indefinite"
            />
          </ellipse>

          {/* Mandíbulas */}
          <path
            d="M 200 100 L 195 105 L 190 108"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M 200 100 L 205 105 L 210 108"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />

          {/* Detalles de cráneo */}
          <path
            d="M 180 75 Q 185 78 190 75"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M 210 75 Q 215 78 220 75"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
            opacity="0.6"
          />
        </g>

        {/* PRIMERA FLOR HIGANBANA (superior derecha) */}
        <g id="flower1" transform="translate(250, 150)">
          {/* Pétalos curvos */}
          <path
            d="M 0 0 Q -15 -25 -20 -45 Q -22 -50 -20 -55"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q -8 -28 -10 -48 Q -11 -53 -9 -58"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 2 -30 0 -50 Q -1 -55 2 -60"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 10 -28 15 -48 Q 17 -53 19 -58"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 18 -25 25 -45 Q 28 -50 30 -55"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 23 -20 32 -38 Q 35 -43 38 -48"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />

          {/* Estambres */}
          <line x1="0" y1="0" x2="-5" y2="-15" stroke="#ff3366" strokeWidth="1" opacity="0.6" />
          <line x1="0" y1="0" x2="0" y2="-18" stroke="#ff3366" strokeWidth="1" opacity="0.6" />
          <line x1="0" y1="0" x2="5" y2="-15" stroke="#ff3366" strokeWidth="1" opacity="0.6" />
          <circle cx="-5" cy="-15" r="1.5" fill="#ff6699" opacity="0.7" />
          <circle cx="0" cy="-18" r="1.5" fill="#ff6699" opacity="0.7" />
          <circle cx="5" cy="-15" r="1.5" fill="#ff6699" opacity="0.7" />
        </g>

        {/* CUELLO */}
        <g id="neck">
          <ellipse
            cx="200"
            cy="130"
            rx="18"
            ry="15"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M 185 125 L 215 125" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <path d="M 185 135 L 215 135" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <rect x="195" y="125" width="10" height="10" fill="url(#texture)" opacity="0.3" />
        </g>

        {/* SEGMENTO 1 */}
        <g id="segment1">
          <ellipse
            cx="200"
            cy="165"
            rx="22"
            ry="18"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M 182 160 L 218 160 L 220 170 L 180 170 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <path d="M 185 162 L 215 162" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 185 168 L 215 168" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <rect x="195" y="160" width="10" height="10" fill="url(#texture)" opacity="0.3" />

          {/* Patas */}
          <path
            d="M 178 165 L 160 155 L 155 150"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 222 165 L 240 155 L 245 150"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="160" cy="155" r="2.5" fill="currentColor" />
          <circle cx="240" cy="155" r="2.5" fill="currentColor" />
        </g>

        {/* SEGUNDA FLOR (izquierda) */}
        <g id="flower2" transform="translate(120, 220)">
          <path
            d="M 0 0 Q -20 -20 -28 -38"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q -12 -25 -15 -42"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q -2 -28 0 -45"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 10 -25 15 -42"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 20 -20 28 -38"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />

          <line x1="0" y1="0" x2="-3" y2="-12" stroke="#ff3366" strokeWidth="0.8" opacity="0.6" />
          <line x1="0" y1="0" x2="0" y2="-15" stroke="#ff3366" strokeWidth="0.8" opacity="0.6" />
          <line x1="0" y1="0" x2="3" y2="-12" stroke="#ff3366" strokeWidth="0.8" opacity="0.6" />
        </g>

        {/* SEGMENTO 2 */}
        <g id="segment2">
          <ellipse
            cx="200"
            cy="210"
            rx="24"
            ry="20"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M 180 203 L 220 203 L 222 215 L 178 215 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <path d="M 183 206 L 217 206" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 183 212 L 217 212" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <rect x="193" y="203" width="14" height="12" fill="url(#texture)" opacity="0.3" />

          <path
            d="M 176 210 L 155 200 L 148 195"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M 224 210 L 245 200 L 252 195"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="155" cy="200" r="3" fill="currentColor" />
          <circle cx="245" cy="200" r="3" fill="currentColor" />
        </g>

        {/* SEGMENTO 3 */}
        <g id="segment3">
          <ellipse
            cx="200"
            cy="260"
            rx="25"
            ry="21"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M 178 252 L 222 252 L 224 268 L 176 268 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <path d="M 181 255 L 219 255" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 181 265 L 219 265" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <rect x="191" y="252" width="18" height="16" fill="url(#texture)" opacity="0.3" />

          <path
            d="M 175 260 L 152 248 L 144 242"
            stroke="currentColor"
            strokeWidth="3.3"
            strokeLinecap="round"
          />
          <path
            d="M 225 260 L 248 248 L 256 242"
            stroke="currentColor"
            strokeWidth="3.3"
            strokeLinecap="round"
          />
          <circle cx="152" cy="248" r="3" fill="currentColor" />
          <circle cx="248" cy="248" r="3" fill="currentColor" />
        </g>

        {/* TERCERA FLOR (derecha) */}
        <g id="flower3" transform="translate(270, 310)">
          <path
            d="M 0 0 Q -18 -22 -25 -40"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q -10 -26 -12 -44"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 0 -28 2 -46"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 12 -26 18 -44"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 22 -22 30 -40"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 28 -18 38 -35"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />

          <line x1="0" y1="0" x2="-4" y2="-14" stroke="#ff3366" strokeWidth="1" opacity="0.6" />
          <line x1="0" y1="0" x2="0" y2="-16" stroke="#ff3366" strokeWidth="1" opacity="0.6" />
          <line x1="0" y1="0" x2="4" y2="-14" stroke="#ff3366" strokeWidth="1" opacity="0.6" />
        </g>

        {/* SEGMENTO 4 (más grande, centro) */}
        <g id="segment4">
          <ellipse
            cx="200"
            cy="320"
            rx="27"
            ry="23"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M 176 311 L 224 311 L 227 329 L 173 329 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.5"
          />
          <path d="M 179 314 L 221 314" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 179 320 L 221 320" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 179 326 L 221 326" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <rect x="188" y="311" width="24" height="18" fill="url(#texture)" opacity="0.4" />

          <path
            d="M 173 320 L 148 306 L 138 298"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 227 320 L 252 306 L 262 298"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="148" cy="306" r="3.5" fill="currentColor" />
          <circle cx="252" cy="306" r="3.5" fill="currentColor" />
        </g>

        {/* SEGMENTO 5 */}
        <g id="segment5">
          <ellipse
            cx="200"
            cy="375"
            rx="26"
            ry="22"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M 177 366 L 223 366 L 226 384 L 174 384 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <path d="M 180 369 L 220 369" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 180 381 L 220 381" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <rect x="190" y="366" width="20" height="18" fill="url(#texture)" opacity="0.3" />

          <path
            d="M 174 375 L 150 362 L 142 356"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <path
            d="M 226 375 L 250 362 L 258 356"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
          <circle cx="150" cy="362" r="3" fill="currentColor" />
          <circle cx="250" cy="362" r="3" fill="currentColor" />
        </g>

        {/* CUARTA FLOR (izquierda) */}
        <g id="flower4" transform="translate(110, 420)">
          <path
            d="M 0 0 Q -22 -18 -30 -35"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q -14 -24 -18 -40"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q -4 -26 -5 -43"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 8 -26 10 -43"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 18 -24 25 -40"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />

          <line x1="0" y1="0" x2="-3" y2="-13" stroke="#ff3366" strokeWidth="0.8" opacity="0.6" />
          <line x1="0" y1="0" x2="0" y2="-15" stroke="#ff3366" strokeWidth="0.8" opacity="0.6" />
          <line x1="0" y1="0" x2="3" y2="-13" stroke="#ff3366" strokeWidth="0.8" opacity="0.6" />
        </g>

        {/* SEGMENTO 6 */}
        <g id="segment6">
          <ellipse
            cx="200"
            cy="435"
            rx="25"
            ry="21"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M 178 427 L 222 427 L 224 443 L 176 443 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <path d="M 181 430 L 219 430" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 181 440 L 219 440" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <rect x="191" y="427" width="18" height="16" fill="url(#texture)" opacity="0.3" />

          <path
            d="M 175 435 L 153 423 L 146 418"
            stroke="currentColor"
            strokeWidth="3.3"
            strokeLinecap="round"
          />
          <path
            d="M 225 435 L 247 423 L 254 418"
            stroke="currentColor"
            strokeWidth="3.3"
            strokeLinecap="round"
          />
          <circle cx="153" cy="423" r="3" fill="currentColor" />
          <circle cx="247" cy="423" r="3" fill="currentColor" />
        </g>

        {/* SEGMENTO 7 */}
        <g id="segment7">
          <ellipse
            cx="200"
            cy="490"
            rx="24"
            ry="20"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M 179 482 L 221 482 L 223 498 L 177 498 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <path d="M 182 485 L 218 485" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 182 495 L 218 495" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <rect x="193" y="482" width="14" height="16" fill="url(#texture)" opacity="0.3" />

          <path
            d="M 176 490 L 156 479 L 150 474"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M 224 490 L 244 479 L 250 474"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="156" cy="479" r="3" fill="currentColor" />
          <circle cx="244" cy="479" r="3" fill="currentColor" />
        </g>

        {/* QUINTA FLOR (derecha) */}
        <g id="flower5" transform="translate(260, 540)">
          <path
            d="M 0 0 Q -16 -20 -22 -38"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q -8 -24 -10 -40"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 2 -26 0 -42"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 12 -24 16 -40"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 20 -20 28 -38"
            stroke="#cc0033"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          />

          <line x1="0" y1="0" x2="-3" y2="-12" stroke="#ff3366" strokeWidth="0.8" opacity="0.6" />
          <line x1="0" y1="0" x2="0" y2="-14" stroke="#ff3366" strokeWidth="0.8" opacity="0.6" />
          <line x1="0" y1="0" x2="3" y2="-12" stroke="#ff3366" strokeWidth="0.8" opacity="0.6" />
        </g>

        {/* SEGMENTO 8 */}
        <g id="segment8">
          <ellipse
            cx="200"
            cy="545"
            rx="23"
            ry="19"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M 180 538 L 220 538 L 222 552 L 178 552 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <path d="M 183 541 L 217 541" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 183 549 L 217 549" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <rect x="193" y="538" width="14" height="14" fill="url(#texture)" opacity="0.3" />

          <path
            d="M 177 545 L 158 535 L 153 531"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 223 545 L 242 535 L 247 531"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="158" cy="535" r="2.5" fill="currentColor" />
          <circle cx="242" cy="535" r="2.5" fill="currentColor" />
        </g>

        {/* SEGMENTO 9 */}
        <g id="segment9">
          <ellipse
            cx="200"
            cy="595"
            rx="21"
            ry="17"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M 182 589 L 218 589 L 220 601 L 180 601 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <path d="M 185 592 L 215 592" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 185 598 L 215 598" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <rect x="193" y="589" width="14" height="12" fill="url(#texture)" opacity="0.3" />

          <path
            d="M 179 595 L 162 587 L 158 584"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M 221 595 L 238 587 L 242 584"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <circle cx="162" cy="587" r="2.5" fill="currentColor" />
          <circle cx="238" cy="587" r="2.5" fill="currentColor" />
        </g>

        {/* SEXTA FLOR (izquierda inferior) */}
        <g id="flower6" transform="translate(130, 640)">
          <path
            d="M 0 0 Q -18 -18 -24 -34"
            stroke="#cc0033"
            strokeWidth="1.3"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q -10 -22 -12 -36"
            stroke="#cc0033"
            strokeWidth="1.3"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 0 -24 2 -38"
            stroke="#cc0033"
            strokeWidth="1.3"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 12 -22 16 -36"
            stroke="#cc0033"
            strokeWidth="1.3"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 20 -18 28 -34"
            stroke="#cc0033"
            strokeWidth="1.3"
            fill="none"
            opacity="0.7"
          />

          <line x1="0" y1="0" x2="-2" y2="-10" stroke="#ff3366" strokeWidth="0.7" opacity="0.6" />
          <line x1="0" y1="0" x2="0" y2="-12" stroke="#ff3366" strokeWidth="0.7" opacity="0.6" />
          <line x1="0" y1="0" x2="2" y2="-10" stroke="#ff3366" strokeWidth="0.7" opacity="0.6" />
        </g>

        {/* SEGMENTO 10 (cola) */}
        <g id="segment10">
          <ellipse
            cx="200"
            cy="640"
            rx="19"
            ry="15"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M 184 635 L 216 635 L 217 645 L 183 645 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <path d="M 187 638 L 213 638" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 187 642 L 213 642" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <rect x="193" y="635" width="14" height="10" fill="url(#texture)" opacity="0.3" />

          <path
            d="M 181 640 L 166 634 L 163 632"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M 219 640 L 234 634 L 237 632"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="166" cy="634" r="2" fill="currentColor" />
          <circle cx="234" cy="634" r="2" fill="currentColor" />
        </g>

        {/* COLA FINAL */}
        <g id="tail">
          <ellipse
            cx="200"
            cy="675"
            rx="16"
            ry="12"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M 187 672 L 213 672" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <path d="M 187 678 L 213 678" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <rect x="193" y="669" width="14" height="12" fill="url(#texture)" opacity="0.3" />

          {/* Patas finales */}
          <path
            d="M 184 675 L 172 670"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 216 675 L 228 670"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Punta de cola */}
          <ellipse
            cx="200"
            cy="700"
            rx="12"
            ry="9"
            fill="url(#bodyGrad)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M 200 709 L 198 720 L 200 715 L 202 720 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
          />
        </g>

        {/* SÉPTIMA FLOR (derecha inferior) */}
        <g id="flower7" transform="translate(255, 685)">
          <path
            d="M 0 0 Q -14 -16 -18 -30"
            stroke="#cc0033"
            strokeWidth="1.2"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q -6 -19 -8 -32"
            stroke="#cc0033"
            strokeWidth="1.2"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 2 -20 0 -34"
            stroke="#cc0033"
            strokeWidth="1.2"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 10 -19 14 -32"
            stroke="#cc0033"
            strokeWidth="1.2"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 0 0 Q 18 -16 24 -30"
            stroke="#cc0033"
            strokeWidth="1.2"
            fill="none"
            opacity="0.7"
          />

          <line x1="0" y1="0" x2="-2" y2="-9" stroke="#ff3366" strokeWidth="0.6" opacity="0.6" />
          <line x1="0" y1="0" x2="0" y2="-11" stroke="#ff3366" strokeWidth="0.6" opacity="0.6" />
          <line x1="0" y1="0" x2="2" y2="-9" stroke="#ff3366" strokeWidth="0.6" opacity="0.6" />
        </g>
      </g>
    </motion.svg>
  );
}
