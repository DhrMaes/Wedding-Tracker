FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY WeddingTracker.slnx ./
COPY src/WeddingTracker.Server/WeddingTracker.Server.csproj src/WeddingTracker.Server/
RUN dotnet restore src/WeddingTracker.Server/WeddingTracker.Server.csproj

COPY . .
RUN dotnet publish src/WeddingTracker.Server/WeddingTracker.Server.csproj \
    --configuration Release \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8095
ENV ASPNETCORE_ENVIRONMENT=Production
ENV WeddingTracker__UploadsDirectory=/app/uploads

EXPOSE 8095

RUN mkdir -p /app/uploads && mkdir -p /app/wwwroot

COPY --from=build /app/publish .
COPY src/WeddingTracker.App ./wwwroot

ENTRYPOINT ["dotnet", "WeddingTracker.Server.dll"]
