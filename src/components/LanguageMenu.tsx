import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n, type Lang } from "@/i18n";

export function LanguageMenu() {
  const { lang, setLang, meta, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" aria-label={t("language")}>
          <Globe className="h-3.5 w-3.5" />
          <span className="text-xs">{meta[lang].label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(meta) as Lang[]).map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLang(code)}
            className={code === lang ? "font-semibold" : ""}
          >
            {meta[code].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
