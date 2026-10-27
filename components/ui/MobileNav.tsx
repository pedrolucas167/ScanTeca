import NavigationDropdown from "./NavigationDropdown";

const LINKS = [
  { href: "/", label: "Catálogo" },
  { href: "/feed", label: "Feed social" },
  { href: "/perfil", label: "Meu perfil" },
  { href: "/descobrir/leitores", label: "Descobrir leitores" },
  { href: "/descobrir", label: "Descobrir" },
  { href: "/jornada", label: "Jornada" },
  { href: "/diario", label: "Diário" },
  { href: "/rota", label: "Rota" },
  { href: "/manifesto", label: "Manifesto" },
  { href: "/oracle", label: "Oráculo" },
];

export default function MobileNav() {
  return <NavigationDropdown links={LINKS} mobile />;
}
