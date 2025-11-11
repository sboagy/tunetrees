import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ICustomLinkProps extends React.LinkHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

const CustomLink = ({
  href,
  children,
  className,
  ...rest
}: ICustomLinkProps) => {
  const isInternalLink = href.startsWith("/");
  const isAnchorLink = href.startsWith("#");

  if (isInternalLink || isAnchorLink) {
    return (
      <Link href={href} className={className} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex align-baseline gap-1 items-center underline underline-offset-4",
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      <ExternalLink className="inline-block ml-0.5 w-4 h-4" />
    </Link>
  );
};

export default CustomLink;
