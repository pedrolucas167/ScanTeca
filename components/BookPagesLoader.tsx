export default function BookPagesLoader({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  return (
    <div className={`relative ${sizeClasses[size]}`}>
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-100%) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(100%) rotate(360deg);
            opacity: 0;
          }
        }

        .page {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 4px;
          animation: fall 2s ease-in-out infinite;
        }

        .page:nth-child(1) {
          background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
          animation-delay: 0s;
          animation-duration: 2.5s;
        }

        .page:nth-child(2) {
          background: linear-gradient(135deg, #e8e8e8 0%, #d0d0d0 100%);
          animation-delay: 0.3s;
          animation-duration: 2.3s;
        }

        .page:nth-child(3) {
          background: linear-gradient(135deg, #ddd 0%, #c0c0c0 100%);
          animation-delay: 0.6s;
          animation-duration: 2.1s;
        }

        .page:nth-child(4) {
          background: linear-gradient(135deg, #d0d0d0 0%, #b0b0b0 100%);
          animation-delay: 0.9s;
          animation-duration: 1.9s;
        }

        .page:nth-child(5) {
          background: linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%);
          animation-delay: 1.2s;
          animation-duration: 1.7s;
        }
      `}</style>
      <div className="page" />
      <div className="page" />
      <div className="page" />
      <div className="page" />
      <div className="page" />
    </div>
  );
}
