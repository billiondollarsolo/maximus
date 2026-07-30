{{- define "maximus.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "maximus.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "maximus.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "maximus.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "maximus.selectorLabels" -}}
app.kubernetes.io/name: {{ include "maximus.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "maximus.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "maximus.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "maximus.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- printf "%s-secrets" (include "maximus.fullname" .) }}
{{- end }}
{{- end }}

{{- define "maximus.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "postgres://%s:%s@%s-postgresql:5432/%s" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "maximus.fullname" .) .Values.postgresql.auth.database }}
{{- else }}
{{- .Values.externalDatabase.url }}
{{- end }}
{{- end }}

{{- define "maximus.valkeyUrl" -}}
{{- if .Values.redis.enabled }}
{{- printf "redis://:%s@%s-valkey:6379" .Values.redis.auth.password (include "maximus.fullname" .) }}
{{- else }}
{{- .Values.externalRedis.url }}
{{- end }}
{{- end }}

{{- define "maximus.s3Endpoint" -}}
{{- if eq .Values.objectStorage.mode "minio" }}
{{- printf "http://%s-minio:9000" (include "maximus.fullname" .) }}
{{- else }}
{{- .Values.objectStorage.external.endpoint }}
{{- end }}
{{- end }}
