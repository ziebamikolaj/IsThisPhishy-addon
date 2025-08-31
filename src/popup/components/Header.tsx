// src/popup/components/Header.tsx
import React from "react";
import { ExternalLink } from "lucide-react";

export const Header: React.FC = () => (
  <div className="mb-3 flex items-center justify-between">
    <div className="flex items-center">
      <img src="/icon.png" width={28} height={28} alt="Logo" className="mr-2" />
      <h1 className="text-lg font-bold text-gray-800">IsThisPhishy?</h1>
    </div>
  </div>
);

export const Footer: React.FC = () => (
  <div className="mt-auto pt-2 border-t border-gray-200 text-center">
    <a
      href="https://github.com/ziebamikolaj/IsThisPhishy-addon"
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-600 hover:underline hover:text-blue-800"
    >
      O projekcie <ExternalLink className="ml-1 h-3 w-3 inline-block" />
    </a>
  </div>
);
