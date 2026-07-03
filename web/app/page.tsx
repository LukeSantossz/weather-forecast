'use client';

import { Card } from '@astryxdesign/core/Card';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Stack } from '@astryxdesign/core/Stack';

export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <Stack>
        <Text>Astryx static-export spike</Text>
        <Card>
          <Text>This card is rendered with Astryx pre-compiled CSS.</Text>
          <Badge label="sample" />
        </Card>
      </Stack>
    </main>
  );
}
