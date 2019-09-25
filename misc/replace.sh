while IFS='=' read key val
do
if [[ -n $val ]];then
sed -i '' "s|$key|$val|gp" 11Normal.html
fi
done < misc.md