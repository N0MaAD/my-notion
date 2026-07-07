# Surveillance des dépendances

## Commandes

- `npm run audit:prod` vérifie uniquement les dépendances de production. Cette commande doit rester à zéro vulnérabilité.
- `npm run audit:all` vérifie aussi les dépendances de développement, dont `firebase-tools`.
- `npm run deps:outdated` liste les mises à jour disponibles à planifier.

## État Firebase / gRPC

Firebase a été monté en `^12.15.0`, ce qui supprime les vulnérabilités hautes de production dans la chaîne `@grpc/grpc-js`.

Un override npm force aussi `protobufjs` en `^7.6.5` pour corriger l'advisory de production restant sans imposer un saut majeur en `8.x` aux dépendances Firebase/gRPC.

À chaque mise à jour Firebase, relancer :

1. `npm install`
2. `npm run audit:prod`
3. `npm run quality`
4. `npm run test:e2e`

Si Firebase ou gRPC dépendent naturellement d'une version corrigée de `protobufjs`, supprimer l'override puis vérifier que `npm run audit:prod` reste propre.

## Alertes développement restantes

Après `npm audit fix` sans `--force`, l'audit production est propre. L'audit complet peut encore signaler des vulnérabilités modérées dans la chaîne `firebase-tools` (`@google-cloud/pubsub`, `@opentelemetry/core`, `gaxios`, `uuid`).

Ne pas lancer `npm audit fix --force` automatiquement : npm propose un changement breaking pour `firebase-tools`. À la place, mettre à jour `firebase-tools` régulièrement puis relancer `npm run audit:all`.
