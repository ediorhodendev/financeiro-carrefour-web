import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../shared/icon';
@Component({
  imports: [RouterLink, Icon],
  template: `
    <div class="page-heading">
      <div>
        <span class="eyebrow">ROTEIRO DO AVALIADOR</span>
        <h1>Do primeiro crédito à recuperação<span class="heading-dot">.</span></h1>
        <p>Um percurso curto para validar as garantias do sistema.</p>
      </div>
      <a routerLink="/" class="button primary">Começar no painel<app-icon name="arrow" /></a>
    </div>
    <div class="guide-grid">
      @for (step of steps; track step.number) {
        <section class="panel guide-card">
          <span class="guide-number">{{ step.number }}</span>
          <h2>{{ step.title }}</h2>
          <p>{{ step.description }}</p>
          <div class="expected">
            <app-icon name="check" /><span>{{ step.expected }}</span>
          </div>
        </section>
      }
    </div>
    <section class="panel documentation-card">
      <h2>Regras que você pode observar</h2>
      <div class="rules-grid">
        <div>
          <h3>Precisão monetária</h3>
          <p>
            Valores positivos com até quatro casas decimais. <code>10,1234</code> é válido;
            <code>10,12345</code> é rejeitado. Não há conversão de dinheiro para ponto flutuante no
            frontend.
          </p>
        </div>
        <div>
          <h3>Saldo autoritativo</h3>
          <p>
            Quem autoriza um débito é o Ledger, na transação. O valor exibido neste painel é uma
            projeção assíncrona e pode estar atrasado.
          </p>
        </div>
        <div>
          <h3>Estorno integral</h3>
          <p>
            Uma entrada oposta referencia o original, sem editar o passado. Apenas um estorno por
            original, sem estornar um compensatório.
          </p>
        </div>
        <div>
          <h3>Repetição segura</h3>
          <p>
            A chave e o corpo são preservados. A repetição concluída retorna o mesmo HTTP 201 e o
            mesmo lançamento. Conteúdo diferente com a mesma chave gera HTTP 422.
          </p>
        </div>
      </div>
      <a
        class="text-button"
        href="https://github.com/ediorhodendev/financeiro-carrefour-v2"
        target="_blank"
        rel="noopener noreferrer"
        >Documentação e contratos do backend<app-icon name="external"
      /></a>
    </section>
  `,
  styles: '',
})
export class Guide {
  readonly steps = [
    {
      number: '01',
      title: 'Conecte o ambiente',
      description:
        'Suba o backend V2 e o frontend com Docker. Clique em Conectar ambiente para obter um JWT de demonstração. Nenhum lançamento é criado nessa etapa.',
      expected: 'Sessão ativa e APIs disponíveis.',
    },
    {
      number: '02',
      title: 'Registre um crédito de R$ 100',
      description:
        'Em Nova movimentação, escolha Crédito, informe 100 e uma descrição. Confirme e acompanhe a sequência em Mensageria.',
      expected: 'HTTP 201. Saldo projetado em R$ 100 após o evento.',
    },
    {
      number: '03',
      title: 'Debite R$ 30 e repita',
      description:
        'Registre um Débito de 30. Na central de mensageria, clique em Testar repetição segura na mesma intenção.',
      expected: 'Saldo R$ 70. Mesmo ID e sequência, sem duplicação.',
    },
    {
      number: '04',
      title: 'Tente ultrapassar o saldo',
      description:
        'Com saldo de R$ 70, envie um débito de 100. O painel informa a rejeição devolvida pelo servidor.',
      expected: 'HTTP 409 por saldo insuficiente. Saldo preservado.',
    },
    {
      number: '05',
      title: 'Estorne o débito de R$ 30',
      description:
        'No extrato, clique em Estornar no débito original. Informe o motivo e confirme o estorno integral.',
      expected: 'Novo crédito compensatório. Saldo volta a R$ 100.',
    },
    {
      number: '06',
      title: 'Interrompa o worker',
      description:
        'Use os comandos da tela Mensageria para pausar o consumo. Lance um crédito de 10, observe a fila e depois retome o worker.',
      expected: 'Fila acumula e depois esvazia. Sequência avança sem duplicar.',
    },
  ];
}
