FROM node:lts

WORKDIR /auto-trade-program

# timezone
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

COPY . .

RUN yarn
RUN yarn build

EXPOSE 3001

CMD [ "yarn", "start" ]