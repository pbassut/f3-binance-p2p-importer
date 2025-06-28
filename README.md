# F-III Binance P2P Importer 🚀

> **Conversor universal de CSV P2P da Binance para Firefly-III**

Este projeto monitora uma pasta e converte automaticamente qualquer arquivo CSV de transações em um formato mais aceito pelo [Firefly-III](https://www.firefly-iii.org/), facilitando a importação de dados financeiros de diferentes fontes para o seu gerenciador financeiro favorito.

## ✨ Funcionalidades

- **Monitoramento automático:** basta jogar um CSV na pasta `input/` e ele será convertido para a pasta `output/`.
- **Conversão flexível:** transforma os campos do CSV de entrada para um formato padrão, incluindo Order Number, Description (com lógica de compra/venda), Created Time e Notes.
- **Compatível com Docker:** rode o conversor facilmente em qualquer ambiente.
- **Testes automatizados:** qualidade garantida com testes usando Vitest.

## 📦 Como usar localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Coloque seu arquivo CSV de entrada na pasta `input/` (exemplo: `input/seuarquivo.csv`).
3. Execute o conversor:
   ```bash
   node index.js
   ```
4. O arquivo convertido aparecerá na pasta `output/` com o mesmo nome.

## 🐳 Como rodar via Docker

1. Construa a imagem:
   ```bash
   docker build -t f3-binance-p2p-importer .
   ```
2. Execute o container, montando o diretório atual:
   ```bash
   docker run --rm -v $(pwd):/app f3-binance-p2p-importer
   ```

## 🔬 Testes

Execute os testes automatizados com:

```bash
npm test
```

## 🔄 Personalização

- Edite a função `transformRow` em `process.js` para adaptar a lógica de transformação para o seu banco ou corretora.
- O campo **Description** é montado automaticamente com base no tipo de operação e contrapartida.
- O campo **Notes** agrega todos os outros campos não utilizados, facilitando a auditoria.

## 💡 Exemplo de uso

Coloque um arquivo como este em `input/`:

```csv
Order Number,Order Type,Asset Type,Fiat Type,Total Price,Price,Quantity,Exchange rate,Maker Fee,Taker Fee,Couterparty,Status,Created Time
10000000000000000001,Sell,USDT,BRL,1000.00,5.70,175.00,0.00,,0.05,AnonA,Completed,2025-03-27 21:03:53
10000000000000000005,Buy,USDT,BRL,500.00,5.74,87.12,0.00,,0.05,AnonE,Completed,2025-03-29 10:00:00
```

E receba em `output/` um arquivo pronto para importar no Firefly-III:

```csv
Order Number,Description,Created Time,Notes
10000000000000000001,"Venda de USDT para AnonA",2025-03-27 21:03:53,"Fiat Type: BRL | Total Price: 1000.00 | Price: 5.70 | Quantity: 175.00 | Exchange rate: 0.00 | Taker Fee: 0.05 | Status: Completed"
10000000000000000005,"Compra de USDT de AnonE",2025-03-29 10:00:00,"Fiat Type: BRL | Total Price: 500.00 | Price: 5.74 | Quantity: 87.12 | Exchange rate: 0.00 | Taker Fee: 0.05 | Status: Completed"
```

## 🤝 Contribuição

Pull requests são bem-vindos! Sinta-se à vontade para abrir issues ou sugerir melhorias.

---

Feito com ❤️ para facilitar sua vida financeira!
