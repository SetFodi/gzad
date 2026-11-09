// Original Tbilisi illustration. The distant landmarks move more slowly
// than the balconies in front, and both panoramas repeat without a gap.

function Hills() {
  return (
    <svg viewBox="0 0 1000 340" fill="none" aria-hidden>
      <path d="M0 240C66 219 107 147 167 137S261 191 342 207 438 172 508 192 595 231 655 212 740 148 808 151 922 219 1000 240V340H0Z" fill="#202526" />
      <path d="M0 265C88 243 157 209 221 221S330 267 408 247 510 226 579 253 713 213 786 217 908 257 1000 265V340H0Z" fill="#252927" />
      {/* Mtatsminda and the TV tower. */}
      <g stroke="#bfa184" strokeWidth="1.3" strokeLinejoin="round">
        <path d="M162 140 173 52 184 140M167 102H179M170 77H176M173 52V10" />
        <path d="M165 130 180 112M167 108 178 91M169 88 176 74M180 130 166 111M178 108 169 91" opacity="0.4" />
        <path d="M162 59H184V67H162Z" fill="#4b3934" />
        <path d="M165 49H181V56H165Z" fill="#5c4336" />
      </g>
      <path d="M164 62H182M167 52H179" stroke="#f0bf88" strokeWidth="2" />
      <circle cx="173" cy="10" r="1.8" fill="#d88b79" />
      <path d="M119 165 143 149H165L186 162H119Z" fill="#655146" />
      <path d="M126 163H181V173H126Z" fill="#3d3b34" stroke="#84705a" strokeWidth="0.8" />
      <path d="M131 166H176" stroke="#edbc83" strokeWidth="2" strokeDasharray="2 5" opacity="0.6" />
      {/* Fortress walls on the opposite hillside. */}
      <path d="M713 194V172H723V164H734V172H746V163H757V172H770V155H779V147H790V155H799V179L816 172V158H826V150H837V158H848V180L870 192V207Z" fill="#504339" stroke="#8c7259" strokeWidth="1" />
      <path d="M719 184 769 180M774 165V177M822 167V177M839 167V177" stroke="#b48b5b" strokeWidth="1.5" opacity="0.65" />
      <path d="M755 184V156H778V184M751 157 766 142 782 157Z" fill="#6d5945" />
      <path d="M766 144V132M762 136H770" stroke="#b49a73" strokeWidth="1" />
      <path d="M762 183V171Q766 165 770 171V183" fill="#292b27" />
      <path d="M0 282Q115 256 210 269T405 278T595 272T790 270T1000 282V340H0Z" fill="#242b28" />
      <g fill="#c89765" opacity="0.35">
        {[43, 72, 106, 236, 264, 319, 385, 414, 565, 591, 630, 686, 893, 928, 963].map((x, i) => <circle key={x} cx={x} cy={252 + (i % 3) * 8} r="1.1" />)}
      </g>
    </svg>
  )
}

function House({ x, y, width, paint, balcony = '#5d7469' }: { x: number; y: number; width: number; paint: string; balcony?: string }) {
  const windows = [width * 0.19, width * 0.47, width * 0.75]
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 15 ${width / 2} 0 ${width} 15Z`} fill="#68493f" stroke="#8b6150" strokeWidth="0.8" />
      <path d={`M0 15H${width}V131H0Z`} fill={paint} stroke="#756353" strokeWidth="0.8" />
      <path d={`M-3 16H${width + 3}M-2 20H${width + 2}M0 78H${width}`} stroke="#aa9270" strokeWidth="1.4" opacity="0.55" />
      {windows.map((wx, i) => (
        <g key={wx}>
          <path d={`M${wx} 59V36Q${wx + 6} 27 ${wx + 12} 36V59Z`} fill={i === 1 ? '#b78d59' : '#785f45'} stroke="#c3a27b" strokeWidth="0.9" />
          <path d={`M${wx + 6} 34V59M${wx} 44H${wx + 12}`} stroke="#463e32" strokeWidth="1.2" />
          <rect x={wx} y="89" width="12" height="23" rx="5" fill="#c39b65" opacity={i === 2 ? 0.26 : 0.5} />
          <path d={`M${wx + 6} 91V112`} stroke="#514534" strokeWidth="1" />
        </g>
      ))}
      {/* Projecting wooden balconies and carved railings. */}
      <path d={`M-5 58H${width + 5}V76H-5Z`} fill={balcony} stroke="#a69b7a" strokeWidth="0.9" />
      <path d={`M-5 62H${width + 5}M-5 72H${width + 5}M-7 77H${width + 7}`} stroke="#c4b28b" strokeWidth="0.8" />
      {Array.from({ length: Math.floor(width / 6) }, (_, i) => (
        <path key={i} d={`M${i * 6} 62V72M${i * 6} 63l4 4-4 4`} stroke="#c4b28b" strokeWidth="0.7" opacity="0.65" />
      ))}
      <path d={`M0 77 7 84M${width} 77l-7 7M5 57V22M${width - 5} 57V22`} stroke={balcony} strokeWidth="2" />
    </g>
  )
}

function OldTown() {
  return (
    <svg viewBox="0 0 1000 260" fill="none" aria-hidden>
      <House x={-12} y={136} width={93} paint="#4e423c" />
      <House x={85} y={116} width={87} paint="#675244" balcony="#465f5c" />
      <House x={176} y={145} width={73} paint="#514b3d" />
      <House x={255} y={131} width={98} paint="#6a5147" balcony="#796253" />
      <House x={360} y={112} width={88} paint="#514b43" balcony="#5e6b62" />
      <House x={455} y={137} width={100} paint="#705b48" />
      <House x={562} y={124} width={85} paint="#5b4841" balcony="#4d6964" />
      <House x={654} y={142} width={77} paint="#655443" />
      <House x={738} y={112} width={101} paint="#685247" balcony="#786351" />
      <House x={845} y={139} width={80} paint="#534b3e" balcony="#4d6c62" />
      <House x={932} y={122} width={82} paint="#625345" />
      <path d="M0 254H1000" stroke="#ab8e60" strokeOpacity="0.55" />
    </svg>
  )
}

export default function TbilisiBackdrop() {
  return (
    <div aria-hidden>
      <div className="lp-drive-hills">
        <div className="lp-drive-hills-track"><Hills /><Hills /></div>
      </div>
      <div className="lp-drive-city">
        <div className="lp-drive-city-track"><OldTown /><OldTown /></div>
      </div>
    </div>
  )
}
