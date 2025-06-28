# f3-binance-p2p-importer

Este projeto processa um arquivo CSV de entrada e gera um novo CSV em outro formato.

## Como usar localmente

1. Coloque seu arquivo `input.csv` na raiz do projeto.
2. Execute:

```bash
npm install
node index.js
```

O arquivo convertido será salvo como `output.csv`.

## Como rodar via Docker

1. Construa a imagem:

```bash
docker build -t f3-binance-p2p-importer .
```

2. Execute o container, montando o diretório com o CSV:

```bash
docker run --rm -v $(pwd):/app f3-binance-p2p-importer
```

O arquivo `output.csv` será gerado no mesmo diretório.

## Personalização

Edite a função `transformRow` em `index.js` para ajustar a transformação conforme o formato desejado.
