/**
 * Settings Panel - User preferences and game options
 */

import { useSettingsStore } from "@/store/settingsStore";
import { SETTINGS_METADATA, UserSettings } from "@/types/settings";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/8bit/card";
import { Label } from "@/components/ui/8bit/label";
import { Switch } from "@/components/ui/8bit/switch";
import { Button } from "@/components/ui/8bit/button";

/**
 * Group settings by category for organized display
 */
const settingsByCategory = SETTINGS_METADATA.reduce(
  (acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  },
  {} as Record<string, typeof SETTINGS_METADATA>
);

const categoryLabels: Record<string, string> = {
  roster: "Roster Management",
  gameplay: "Gameplay",
  ui: "User Interface",
  advanced: "Advanced",
};

const categoryDescriptions: Record<string, string> = {
  roster: "Automatic lineup and roster management options",
  gameplay: "Adjust gameplay mechanics and difficulty",
  ui: "Customize the user interface",
  advanced: "Advanced settings for experienced players",
};

export default function SettingsPanel() {
  const settings = useSettingsStore();

  const handleToggle = (key: keyof UserSettings, value: boolean) => {
    settings.setSetting(key, value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="text-muted-foreground mt-2">
          Customize your Dugout Dynasty experience
        </p>
      </div>

      {Object.entries(settingsByCategory).map(([category, categorySettings]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{categoryLabels[category]}</CardTitle>
            <CardDescription>{categoryDescriptions[category]}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {categorySettings.map((setting) => (
              <div
                key={setting.key}
                className="flex items-center justify-between space-x-4"
              >
                <div className="flex-1 space-y-1">
                  <Label htmlFor={setting.key} className="text-base font-medium">
                    {setting.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {setting.description}
                  </p>
                </div>
                {setting.type === "boolean" && (
                  <Switch
                    id={setting.key}
                    checked={settings[setting.key] as boolean}
                    onCheckedChange={(checked: boolean) =>
                      handleToggle(setting.key, checked)
                    }
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Reset Settings</CardTitle>
          <CardDescription>
            Restore all settings to their default values
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => settings.resetSettings()} variant="outline">
            Reset to Defaults
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
