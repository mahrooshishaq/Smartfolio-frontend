export default function AnimatedBackground() {
  return (
    <div className="absolute inset-0 -z-10 bg-white">
      {/* Blue Ellipse */}
      <div 
        className="absolute w-[800px] h-[800px] rounded-full blur-3xl opacity-60"
        style={{
          background: '#D6E4FF',
          animation: 'float-1 20s ease-in-out infinite',
          top: '-20%',
          left: '-10%'
        }}
      />
      {/* Purple Ellipse */}
      <div 
        className="absolute w-[700px] h-[700px] rounded-full blur-3xl opacity-50"
        style={{
          background: '#E5D4FF',
          animation: 'float-2 25s ease-in-out infinite',
          top: '30%',
          right: '-15%'
        }}
      />
      {/* Orange Ellipse */}
      <div 
        className="absolute w-[900px] h-[900px] rounded-full blur-3xl opacity-60"
        style={{
          background: '#FFE4D6',
          animation: 'float-3 30s ease-in-out infinite',
          bottom: '-25%',
          left: '20%'
        }}
      />
    </div>
  );
}
