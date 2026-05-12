import React from 'react';

type Props = {
  title: string;
  value: string;
};

export default function InfoBox({ title, value }: Props) {
  return (
    <div className="bg-[#0D1B2E] text-white p-3 rounded-lg">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
