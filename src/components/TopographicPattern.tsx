const TopographicPattern = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 800 600"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid slice"
  >
    <defs>
      <linearGradient id="topoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.06" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#topoGrad)" />
    {/* Contour lines inspired by topographic maps */}
    <g stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.12">
      <path d="M50,300 Q150,200 300,250 T550,220 T750,280" />
      <path d="M30,320 Q160,220 320,270 T560,240 T770,300" />
      <path d="M60,340 Q170,250 310,290 T540,260 T740,320" />
      <path d="M80,280 Q200,180 350,230 T580,200 T760,260" />
      <path d="M40,360 Q180,270 330,310 T570,280 T780,340" />
    </g>
    <g stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.08">
      <path d="M100,150 Q250,80 400,130 T650,100 T800,160" />
      <path d="M80,170 Q230,100 380,150 T630,120 T780,180" />
      <path d="M120,130 Q270,60 420,110 T670,80 T800,140" />
      <path d="M0,400 Q150,330 300,380 T550,350 T750,410" />
      <path d="M20,420 Q170,350 320,400 T570,370 T770,430" />
      <path d="M0,440 Q160,370 310,420 T560,390 T760,450" />
    </g>
    <g stroke="currentColor" strokeWidth="0.3" fill="none" opacity="0.05">
      <path d="M0,50 Q200,10 400,60 T800,30" />
      <path d="M0,70 Q200,30 400,80 T800,50" />
      <path d="M0,500 Q200,460 400,510 T800,480" />
      <path d="M0,520 Q200,480 400,530 T800,500" />
      <path d="M0,540 Q200,500 400,550 T800,520" />
      <path d="M0,560 Q200,520 400,570 T800,540" />
    </g>
    {/* Elevation markers */}
    <g fill="currentColor" opacity="0.06">
      <circle cx="300" cy="240" r="3" />
      <circle cx="550" cy="210" r="2" />
      <circle cx="150" cy="320" r="2.5" />
      <circle cx="650" cy="350" r="2" />
    </g>
  </svg>
);

export default TopographicPattern;
