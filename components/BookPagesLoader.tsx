"use client";

import { motion, useReducedMotion } from "motion/react";

type BookLoaderProps = {
  size?: number;
  label?: string;
};

export function BookLoader({
  size = 120,
  label = "Preparando sua biblioteca...",
}: BookLoaderProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      role="status"
      aria-label={label}
      className="book-loader"
      style={{ width: size }}
    >
      <svg viewBox="0 0 120 100" width={size} aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Sombra do livro */}
        <ellipse cx="60" cy="83" rx="38" ry="5" fill="#5B1827" opacity="0.12" />

        {/* Miolo do livro */}
        <path
          d="M20 26 Q39 20 60 32 Q81 20 100 26 L100 73 Q80 67 60 79 Q40 67 20 73 Z"
          fill="#F3E7D0"
          stroke="#6F2638"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Capa esquerda */}
        <path
          d="M20 26 Q39 20 60 32 L60 79 Q40 67 20 73 Z"
          fill="#7A293D"
          stroke="#5B1827"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Capa direita */}
        <path
          d="M60 32 Q81 20 100 26 L100 73 Q80 67 60 79 Z"
          fill="#F8EEDC"
          stroke="#6F2638"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Lombada */}
        <path
          d="M60 32 V79"
          stroke="#5B1827"
          strokeWidth="2"
        />

        {/* Detalhes da página esquerda */}
        <path
          d="M28 34 Q41 31 52 38 M28 42 Q41 39 52 46 M28 50 Q41 47 52 54"
          stroke="#E8D3B6"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Página que vira */}
        <motion.path
          d="M60 32 Q78 22 94 27 L94 68 Q77 62 60 76 Z"
          fill="#FFF8EA"
          stroke="#C9AD91"
          strokeWidth="1.2"
          strokeLinejoin="round"
          style={{
            transformBox: "view-box",
            transformOrigin: "60px 32px",
          }}
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : {
                  rotateY: [0, -32, 0],
                  skewY: [0, -3, 0],
                }
          }
          transition={{
            duration: 1.8,
            repeat: shouldReduceMotion ? 0 : Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Linhas da página direita */}
        <path
          d="M69 39 Q79 35 89 36 M69 47 Q79 43 89 44 M69 55 Q79 51 89 52"
          stroke="#D7C1A5"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      <span className="book-loader__label">{label}</span>

      <style>{`
        .book-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #6F2638;
        }

        .book-loader__label {
          font-family: Georgia, serif;
          font-size: 13px;
          text-align: center;
        }

        @media (prefers-reduced-motion: reduce) {
          .book-loader * {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default BookLoader;
