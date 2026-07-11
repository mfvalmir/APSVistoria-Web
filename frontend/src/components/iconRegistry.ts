import {
  User,
  Users,
  FileText,
  ShieldCheck,
  Map,
  MapPin,
  Briefcase,
  Tag,
  Landmark,
  Contact,
  Wrench,
  Truck,
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardCheck,
  Wallet,
  Circle,
  type LucideIcon,
} from "lucide-react";

const registro: Record<string, LucideIcon> = {
  User,
  Users,
  FileText,
  ShieldCheck,
  Map,
  MapPin,
  Briefcase,
  Tag,
  Landmark,
  Contact,
  Wrench,
  Truck,
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardCheck,
  Wallet,
};

export function getIcone(nome: string | null): LucideIcon {
  if (!nome) return Circle;
  return registro[nome] || Circle;
}

export const NOMES_ICONES = Object.keys(registro);
