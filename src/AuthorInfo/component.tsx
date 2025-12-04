import type React from "react";
import { AUTHOR } from "~/constants/author";

type Props = {
  className?: string;
};

export const AuthorInfo: React.FC<Props> = ({ className }) => {
  return (
    <a
      href={AUTHOR.websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex flex-col items-center gap-2 group transition-transform hover:scale-105 ${className ?? ""}`}
    >
      <img
        src={AUTHOR.avatarPath}
        alt={AUTHOR.name}
        className="w-16 h-16 rounded-full object-cover shadow-lg ring-2 ring-gray-300 group-hover:ring-blue-400 transition-all"
      />
      <span className="text-sm text-gray-600 group-hover:text-blue-500 transition-colors">
        Created by {AUTHOR.name}
      </span>
    </a>
  );
};
