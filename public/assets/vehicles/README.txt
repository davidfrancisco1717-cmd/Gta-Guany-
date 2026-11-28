SISTEMA DE VEICULOS 3D — WEBGTA (SAN VERDE 3D)

Cada pasta dentro de public/assets/vehicles/<id_veiculo>/ contem:
- config.json: especificacoes fisicas, dimensoes, camara interior, identificacao de rodas e caminho opcional "modelUrl" (.glb/.gltf).
- model.glb (opcional): modelo 3D externo em formato GLB/GLTF.

Para integrar um modelo .glb/.gltf personalizado:
1. Coloca o ficheiro .glb na pasta do veiculo (ex: public/assets/vehicles/camaro_ss/model.glb).
2. Define "modelUrl": "/assets/vehicles/camaro_ss/model.glb" no respetivo config.json.
3. Ou importa diretamente no jogo atraves da Garagem -> "Importar .GLB / .GLTF".

O VehicleAssetLoader normaliza automaticamente escala, orientacao (+Z), altura ao solo (min.y = 0) e pivots de rotacao/direcao das rodas.
