const carros = [
  { nome: "Onix", status: "disponivel" },
  { nome: "Gol", status: "ocupado", usuario: "Carlos" },
  { nome: "Fiesta", status: "disponivel" },
  { nome: "HB20", status: "ocupado", usuario: "Ana" },
  { nome: "Corolla", status: "disponivel" },
  { nome: "Argo", status: "ocupado", usuario: "Pedro" }
];

const mural = document.getElementById("muralCarros");

carros.forEach(carro => {
  const div = document.createElement("div");
  div.classList.add("carro-card", carro.status);

  div.innerHTML = `
    <div class="carro-nome">🚗 ${carro.nome}</div>
    <div class="carro-status">
      ${carro.status === "disponivel" ? "Disponível" : "Em uso por " + carro.usuario}
    </div>
  `;

  mural.appendChild(div);
});
