import { Meta, StoryObj } from "@storybook/react";
import { SpotlightPortraits } from "./SpotlightPortraits";
import { WoWPlayer } from "../types";

const meta = {
  title: "Components/SpotlightPortraits",
  component: SpotlightPortraits,
  decorators: [
    (Story) => (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          background: "var(--bg-primary)",
          padding: "2rem",
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpotlightPortraits>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper to construct a minimal player for Storybook
const makePlayer = (name: string, role: string, mediaUrl?: string): WoWPlayer =>
  ({
    name,
    discordId: name,
    mainRole: role as any,
    offspecs: [],
    utilities: [],
    mediaUrl,
  }) as unknown as WoWPlayer;

export const CompleteGroup: Story = {
  args: {
    players: [
      makePlayer(
        "Pandemonium",
        "tank",
        "https://render.worldofwarcraft.com/us/character/sargeras/123/184140522-inset.jpg",
      ),
      makePlayer(
        "Martz",
        "healer",
        "https://render.worldofwarcraft.com/us/character/illidan/456/184140522-inset.jpg",
      ),
      makePlayer(
        "Tytanium",
        "melee",
        "https://render.worldofwarcraft.com/us/character/proudmoore/789/184140522-inset.jpg",
      ),
      makePlayer("Jules", "ranged"),
      makePlayer("Dpser", "melee"),
    ],
  },
};

export const MissingAvatars: Story = {
  args: {
    players: [
      makePlayer("Tanky", "tank"),
      makePlayer("Healy", "healer"),
      makePlayer("Pewpew", "ranged"),
      makePlayer("Stabstab", "melee"),
      makePlayer("Boomkin", "ranged"),
    ],
  },
};
