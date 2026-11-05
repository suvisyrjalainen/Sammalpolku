# Sammalpolku

Viisi labyrinttiä, 35 kolikkoa ja ennätystaulukko kaikkien tasojen kokonaisajoille.

Pelaa selaimessa [GitHub Pagesissa](https://suvisyrjalainen.github.io/Sammalpolku/).
Pages-versiossa ennätykset tallentuvat pelaajan omaan selaimeen.

## Pelaaminen tiedostosta

Avaa `index.html` selaimessa. Peli ei tarvitse asennuksia tai verkkoyhteyttä.
Ennätystaulukko tallennetaan tällöin vain saman selaimen paikalliseen muistiin.
Selain voi estää paikallisen tallennuksen; peli ilmoittaa silloin virheestä.

## Nopea testi yhdellä tasolla

Paina pelissä **Testaa tulostaulukkoa: vain 10 × 10**. Testitilassa viiden kolikon
kerääminen ja ensimmäisestä ovesta kulkeminen riittävät ajan tallentamiseen.
Testitulokset ovat omassa taulukossaan. Palaa normaalipeliin **Takaisin viiden tason peliin** -linkistä.
Tämä toimii myös avaamalla `index.html` suoraan ilman Node.js:ää.
Palvelimella testitilan osoite on http://localhost:3000/?test=1 ja sen erillinen
tulostiedosto on `data/scores.json.test`.

## Yhteinen ennätystaulukko

Palvelin käyttää Node.js:n omia moduuleja. Ei npm-asennuksia tai ulkoisia kirjastoja.
Jos Node.js on asennettuna, suorita tässä kansiossa:

```powershell
node server.cjs
```

Avaa selaimessa http://localhost:3000. Saman palvelimen kautta pelaavat näkevät yhteiset
tulokset. Nimimerkki ja aika tallennetaan viidennen tason jälkeen pelaajan painaessa
Tallenna aika. Taulukossa säilytetään 10 nopeinta suoritusta; sama nimimerkki voi
esiintyä useasti.

Tulokset säilyvät palvelimen `data/scores.json`-tiedostossa uudelleenkäynnistysten yli.
Tuotantopalvelussa tämä tiedosto tarvitsee pysyvän levyn. Tallennuspolun voi asettaa
`SCORES_FILE`-ympäristömuuttujalla ja portin `PORT`-muuttujalla.

Peliä ei ole vielä julkaistu internetiin. Julkiseen pelaamiseen tarvitaan Node.js:ää
ajava julkaisupaikka, pysyvä tulostallennus ja HTTPS-osoite. Pelkkä staattisen
index.html-tiedoston julkaiseminen ei käynnistä yhteistä ennätystaulukkoa.

Tämä on rentoon pelaamiseen tarkoitettu taulukko: palvelin tarkistaa nimen ja ajan
muodon, mutta ei varmista pelisuoritusta. Kilpailukäyttöön tarvitaan lisäksi
palvelimella tehtävä suorituksen tarkistus ja väärien tulosten lähettämisen esto.

## Tarkistukset

Suorita `node test.cjs`. Tarkistukset käyttävät väliaikaista tulostiedostoa ja
paikallista HTTP-palvelinta. Ne varmistavat tulosten järjestyksen, säilymisen,
virheellisten syötteiden hylkäyksen sekä kaikkien viiden tason läpäisyn ja tallennuksen.
