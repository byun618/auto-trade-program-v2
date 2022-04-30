#/bin/bash
version=$1

echo "Set Version: ${version}"

echo "Build Start"
docker build -t "byun618/auto-trade-program:${version}" .

echo "Push Start"
docker push "byun618/auto-trade-program:${version}"

echo "Rolling Update Start"
kubectl set image deployment/auto-trade-program-byun618-1 auto-trade-program-byun618-1=byun618/auto-trade-program:${version}
kubectl set image deployment/auto-trade-program-byun618-2 auto-trade-program-byun618-2=byun618/auto-trade-program:${version}

echo "END "