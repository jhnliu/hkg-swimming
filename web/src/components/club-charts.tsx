"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { ClubSeasonStats, ClubStrokeStrength } from "@/lib/db";

export function MemberChart({
  data,
  labels,
}: {
  data: ClubSeasonStats[];
  labels: { members: string; male: string; female: string };
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-pool-border)" opacity={0.5} />
        <XAxis
          dataKey="season"
          tick={{ fontSize: 12, fill: "var(--color-foreground)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "var(--color-foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            opacity: 0.95,
          }}
          labelStyle={{ color: "var(--color-foreground)" }}
        />
        <Legend />
        <Bar
          dataKey="male_count"
          name={labels.male}
          fill="#0284c7"
          stackId="members"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="female_count"
          name={labels.female}
          fill="#ec4899"
          stackId="members"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MedalChart({
  data,
  labels,
}: {
  data: ClubSeasonStats[];
  labels: { gold: string; silver: string; bronze: string };
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-pool-border)" opacity={0.5} />
        <XAxis
          dataKey="season"
          tick={{ fontSize: 12, fill: "var(--color-foreground)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "var(--color-foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            opacity: 0.95,
          }}
          labelStyle={{ color: "var(--color-foreground)" }}
        />
        <Legend />
        <Bar dataKey="gold" name={labels.gold} fill="#eab308" stackId="medals" />
        <Bar dataKey="silver" name={labels.silver} fill="#94a3b8" stackId="medals" />
        <Bar
          dataKey="bronze"
          name={labels.bronze}
          fill="#d97706"
          stackId="medals"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GenderPie({
  male,
  female,
  labels,
}: {
  male: number;
  female: number;
  labels: { male: string; female: string };
}) {
  const data = [
    { name: labels.male, value: male },
    { name: labels.female, value: female },
  ];
  const colors = ["#0284c7", "#ec4899"];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label={(props: any) =>
            `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

const STROKE_EN: Record<string, string> = {
  Freestyle: "Freestyle",
  Backstroke: "Backstroke",
  Breaststroke: "Breaststroke",
  Butterfly: "Butterfly",
  IM: "Individual Medley",
  "Freestyle Relay": "Freestyle Relay",
};
const STROKE_ZH: Record<string, string> = {
  Freestyle: "自由泳",
  Backstroke: "背泳",
  Breaststroke: "蛙泳",
  Butterfly: "蝶泳",
  IM: "個人四式",
  "Freestyle Relay": "自由泳接力",
};

export function StrokeTable({
  data,
  lang,
}: {
  data: ClubStrokeStrength[];
  lang: string;
}) {
  const formatStroke = (s: string) =>
    (lang === "zh" ? STROKE_ZH[s] : STROKE_EN[s]) || s;
  return (
    <div className="overflow-x-auto rounded-lg border border-pool-border dark:border-pool-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-pool-border bg-pool-surface dark:border-pool-border dark:bg-surface-alt">
            <th className="px-3 py-2 text-left font-semibold text-pool-deep dark:text-pool-light">
              {lang === "en" ? "Stroke" : "泳式"}
            </th>
            <th className="px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
              {lang === "en" ? "Avg Place" : "平均名次"}
            </th>
            <th className="px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
              {lang === "en" ? "Results" : "成績數"}
            </th>
            <th className="px-3 py-2 text-center font-semibold text-pool-deep dark:text-pool-light">
              {lang === "en" ? "Medals" : "獎牌"}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.stroke}
              className={`water-row border-b border-pool-border/50 dark:border-pool-border/50 ${
                i % 2 === 1 ? "bg-pool-surface/50 dark:bg-surface-alt/30" : ""
              }`}
            >
              <td className="px-3 py-2 font-medium text-foreground">
                {formatStroke(row.stroke)}
              </td>
              <td className="px-3 py-2 text-center text-foreground/80">
                {row.avg_place}
              </td>
              <td className="px-3 py-2 text-center text-muted dark:text-pool-light/60">
                {row.result_count.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-center font-medium text-amber-600 dark:text-amber-400">
                {row.medal_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
